// Tâche ponctuelle (workflow « Maintenance », oneoff) : LECTURE SEULE. Erreurs récentes du rangement d'articles (classifyItem)
// et articles du catalogue proches de « schnitzel » / « coton ».
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const logs = (await db.collection("aiLogs").where("at", ">=", Date.now() - 3 * 86400_000).get()).docs.map((d) => d.data()).filter((l) => l.task === "classifyItem" && l.error);
console.log(`Erreurs classifyItem (3 jours) : ${logs.length}`);
logs.slice(-10).forEach((l) => console.log(`  ${new Date(l.at).toISOString()} ${String(l.error).slice(0, 300)}`));
for (const d of (await db.collection("items").get()).docs) if (/schnit|coton|ouate/i.test(`${d.get("name")} ${(d.get("aliases") || []).join(" ")}`)) console.log(`Article : ${d.get("name")} (${d.id}) rayon ${d.get("category")} unité ${d.get("unit")} ${d.get("deleted") ? "SUPPRIMÉ" : ""} ${d.get("mergedInto") ? "fusionné → " + d.get("mergedInto") : ""}`);
