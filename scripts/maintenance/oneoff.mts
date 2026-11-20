// Tâche ponctuelle (workflow « Maintenance », oneoff) : remise en place après la relecture trop sévère.
// Relit toutes les pages gardées en copie (sans relecture payante), une à la fois, puis attend la fin des files ;
// contrôle ensuite quelques articles touchés à tort. Aucun prix affiché.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const caps = (await db.collection("captures").orderBy("at", "desc").limit(30).select("store", "at", "url").get()).docs;
const seen = new Set<string>();
for (const c of caps.filter((x) => { const k = `${x.get("store")}|${String(x.get("url")).split("?")[0]}|${new Date(x.get("at")).toISOString().slice(0, 13)}`; if (seen.has(k)) return false; seen.add(k); return true; }).reverse()) {
  const ref = await db.collection("captureReplays").add({ captureId: c.id, at: Date.now() });
  let line = "pas de réponse en 9 min";
  for (let i = 0; i < 54; i++) {
    await new Promise((r) => setTimeout(r, 10_000));
    const r = (await ref.get()).data()!;
    if (r.doneAt || r.error) { line = r.error ? `erreur : ${r.error}` : `${r.found} lus, ${r.saved} articles avec prix, ${r.created} nouveaux, ${r.queued} en file`; break; }
  }
  console.log(`Relecture ${c.get("store")} (${new Date(c.get("at")).toISOString().slice(0, 16)}) : ${line}`);
}
for (let i = 0; i < 120; i++) {
  const jobs = (await db.collection("enrichJobs").get()).docs;
  if (!jobs.length) { console.log("Files d'attente : toutes terminées"); break; }
  if (i % 6 === 0) console.log("Files : " + jobs.map((j) => `${j.get("pos")}/${(j.get("products") || []).length}${j.get("paused") ? " pause" : ""}`).join(", "));
  await new Promise((r) => setTimeout(r, 20_000));
}
const items = (await db.collection("items").select("name").get()).docs;
for (const n of ["Seau", "Vin rouge Merlot", "Bière blonde", "Jus multifruits", "Pizza margherita", "Langue de bœuf", "Gaufrettes", "Brosses à dents", "Pistaches"]) {
  const it = items.find((d) => d.get("name") === n); if (!it) continue;
  const offers = (await db.collection("prices").where("itemId", "==", it.id).get()).docs.flatMap((d) => (d.get("offers") || []) as { name: string }[]);
  console.log(`  ${n} : ${offers.length} produits — ${offers.slice(0, 5).map((o) => o.name).join(" | ")}`);
}
