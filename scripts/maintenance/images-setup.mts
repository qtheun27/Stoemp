// Prépare la génération des photos de plats : active Vertex AI (modèle d'images de Gemini) sur le projet et donne le droit de l'utiliser
// au compte des Cloud Functions et au compte du déploiement. Chaque étape dit si elle a réussi.
import { GoogleAuth } from "../../functions/node_modules/google-auth-library/build/src/index.js";
const PROJECT = "stoemp-app";
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const client = await auth.getClient();
const req = async (url: string, method = "GET", data?: unknown) => (await client.request<any>({ url, method, data })).data;
const step = async (label: string, f: () => Promise<string | void>) => {
  try { const r = await f(); console.log(`✅ ${label}${r ? ` : ${r}` : ""}`); } catch (e: any) { console.log(`❌ ${label} : ${e?.response?.data?.error?.message || e?.message || e}`); }
};

const proj = await req(`https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}`);
const computeSa = `${proj.projectNumber}-compute@developer.gserviceaccount.com`;
const ciSa = (await auth.getCredentials()).client_email || "stoemp-ci@stoemp-app.iam.gserviceaccount.com";

await step("Activation de Vertex AI (aiplatform.googleapis.com)", async () => {
  const op = await req(`https://serviceusage.googleapis.com/v1/projects/${PROJECT}/services/aiplatform.googleapis.com:enable`, "POST", {});
  for (let i = 0; i < 30 && op.name && !op.done; i++) { await new Promise((r) => setTimeout(r, 4000)); Object.assign(op, await req(`https://serviceusage.googleapis.com/v1/${op.name}`)); }
});
await step(`Droit « Vertex AI User » pour ${computeSa} et ${ciSa}`, async () => {
  const policy = await req(`https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}:getIamPolicy`, "POST", { options: { requestedPolicyVersion: 3 } });
  const role = "roles/aiplatform.user", members = [`serviceAccount:${computeSa}`, `serviceAccount:${ciSa}`];
  const b = policy.bindings.find((x: any) => x.role === role && !x.condition);
  if (b) { const missing = members.filter((m) => !b.members.includes(m)); if (!missing.length) return "déjà en place"; b.members.push(...missing); }
  else policy.bindings.push({ role, members });
  await req(`https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}:setIamPolicy`, "POST", { policy });
});
