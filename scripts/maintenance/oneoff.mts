// Tâche ponctuelle (workflow « Maintenance », oneoff) : relance des files d'attente arrêtées par la mise en ligne,
// et produits Renmans « haché » / « agneau » avec leur article (lecture, aucun prix affiché).
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const jobs = (await db.collection("enrichJobs").get()).docs;
for (const j of jobs) { console.log(`File ${j.get("store")} · ${j.get("pos")}/${(j.get("products") || []).length}${j.get("paused") ? " · pause" : ""} → relancée`); await j.ref.update({ kick: Date.now() }); await new Promise((r) => setTimeout(r, 20_000)); }
const names = new Map((await db.collection("items").select("name").get()).docs.map((d) => [d.id, d.get("name") as string]));
console.log("\nProduits Renmans « haché » / « agneau » / « américain » et leur article :");
for (const d of (await db.collection("prices").where("store", "==", "renmans").get()).docs)
  for (const o of (d.get("offers") || []) as { name: string }[]) if (/hach|agneau|américain|americain/i.test(o.name)) console.log(`  ${o.name} → ${names.get(d.get("itemId"))}`);
