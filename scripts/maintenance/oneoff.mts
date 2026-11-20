// Tâche ponctuelle (workflow « Maintenance », oneoff) : relecture de tout le catalogue de prix, magasin par magasin
// (reviewJobs → onReviewJob, en plusieurs passes si besoin), puis bilan. Aucun prix affiché.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const uid = (await db.collection("captures").orderBy("at", "desc").limit(1).get()).docs[0]?.get("uid");
for (const store of ["renmans", "carrefour", "colruyt"]) {
  const t0 = Date.now();
  await db.collection("reviewJobs").add({ uid, store, url: "", since: "2000-01-01", at: t0, full: true });
  let moved = 0, passes = 0;
  for (let i = 0; i < 180; i++) {
    await new Promise((r) => setTimeout(r, 20_000));
    const jobs = (await db.collection("reviewJobs").where("store", "==", store).get()).docs.map((d) => d.data()).filter((j) => j.at >= t0);
    passes = jobs.length;
    const open = jobs.filter((j) => !j.doneAt && !jobs.some((k) => k.startAfter && k.at > j.at));
    const last = jobs.find((j) => j.doneAt && !jobs.some((k) => k.at > j.at));
    if (last) { moved = (last.movedBefore || 0) + (last.moved || 0); break; }
    if (i % 6 === 0) console.log(`  ${store} : passe ${passes}${open.length ? " en cours" : ""}`);
  }
  console.log(`Relecture ${store} : ${passes} passe(s), ${moved} produits mal rangés déplacés`);
}
