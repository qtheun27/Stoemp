// Tâche ponctuelle (workflow « Maintenance », oneoff) : relecture des pages Carrefour d'aujourd'hui (nouvelles règles de classement),
// une à la fois, puis attente de la fin des files d'attente. Aucun prix affiché.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const since = new Date("2026-11-20T00:00:00Z").getTime();
const caps = (await db.collection("captures").orderBy("at", "desc").limit(30).select("store", "at", "url").get()).docs
  .filter((c) => c.get("store") === "carrefour" && c.get("at") >= since);
const seen = new Set<string>();
for (const c of caps.filter((x) => { const u = String(x.get("url")).split("?")[0]; if (seen.has(u)) return false; seen.add(u); return true; }).reverse()) {
  const ref = await db.collection("captureReplays").add({ captureId: c.id, at: Date.now() });
  let line = "pas de réponse en 9 min";
  for (let i = 0; i < 54; i++) {
    await new Promise((r) => setTimeout(r, 10_000));
    const r = (await ref.get()).data()!;
    if (r.doneAt || r.error) { line = r.error ? `erreur : ${r.error}` : `${r.found} lus, ${r.saved} articles avec prix, ${r.created} nouveaux articles, ${r.queued} en file`; break; }
  }
  console.log(`Relecture ${String(c.get("url")).replace(/^https?:\/\/[^/]+/, "").split("?")[0]} : ${line}`);
}
for (let i = 0; i < 90; i++) {
  const jobs = (await db.collection("enrichJobs").get()).docs;
  if (!jobs.length) { console.log("Files d'attente : toutes terminées"); break; }
  if (i % 6 === 0) console.log("Files : " + jobs.map((j) => `${j.get("pos")}/${(j.get("products") || []).length}${j.get("paused") ? " pause" : ""}`).join(", "));
  await new Promise((r) => setTimeout(r, 20_000));
}
