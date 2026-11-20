// Tâche ponctuelle (workflow « Maintenance », oneoff) : diagnostic EN LECTURE SEULE du dernier envoi Carrefour (aucun prix affiché).
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const since = Date.now() - 6 * 3600_000;
const caps = (await db.collection("captures").orderBy("at", "desc").limit(10).get()).docs.map((d) => d.data());
for (const c of caps.filter((x) => x.at >= since)) console.log(`Capture ${c.store} · ${new Date(c.at).toISOString()} · ${c.length} car. · ${(String(c.text).match(/€/g) || []).length} « € »`);
const jobs = (await db.collection("enrichJobs").get()).docs.map((d) => d.data());
console.log(`\nFile d'attente : ${jobs.length} envoi(s)`);
for (const j of jobs) console.log(`  ${j.store} · ${j.pos}/${(j.products || []).length} produits classés · lancé ${new Date(j.at).toISOString()}`);
const logs = (await db.collection("aiLogs").where("at", ">=", since).get()).docs.map((d) => d.data());
for (const task of ["classifyItem", "extractPrices", "matchProduct"]) {
  const l = logs.filter((x) => x.task === task), errs = l.filter((x) => x.error).map((x) => String(x.error).slice(0, 140));
  console.log(`\n${task} (6 h) : ${l.length} appels, ${errs.length} erreurs${errs.length ? " — " + [...new Set(errs)].slice(0, 4).join(" | ") : ""}`);
}
const day = new Date(Date.now() - 6 * 3600_000).toISOString();
const prices = await db.collection("prices").where("store", "==", "carrefour").where("fetchedAt", ">=", day).count().get();
console.log(`\nPrix Carrefour enregistrés ces 6 h : ${prices.data().count}`);
const items = await db.collection("items").where("createdAt", ">=", since).count().get().catch(() => null);
if (items) console.log(`Articles créés ces 6 h : ${items.data().count}`);
