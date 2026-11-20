// Tâche ponctuelle (workflow « Maintenance », oneoff) : arrête la file d'attente Carrefour et retire les prix Carrefour
// capturés aujourd'hui (noms décalés d'une carte : chaque prix était rattaché au produit suivant). Les articles créés
// et les alias appris (noms de produits justes) sont gardés. Aucun prix affiché dans le journal.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const jobs = (await db.collection("enrichJobs").get()).docs.filter((d) => d.get("store") === "carrefour");
for (const j of jobs) { console.log(`File arrêtée : ${j.get("pos")}/${(j.get("products") || []).length} produits traités`); await j.ref.delete(); }
const since = "2026-11-20T00:00:00";
const prices = (await db.collection("prices").where("store", "==", "carrefour").get()).docs.filter((d) => d.get("source") === "capture" && String(d.get("fetchedAt")) >= since);
const hist = (await db.collection("priceHistory").where("store", "==", "carrefour").get()).docs.filter((d) => d.get("source") === "capture" && String(d.get("fetchedAt")) >= since);
const w = db.bulkWriter();
prices.forEach((d) => w.delete(d.ref)); hist.forEach((d) => w.delete(d.ref));
await w.close();
console.log(`Prix Carrefour retirés : ${prices.length} fiches, ${hist.length} lignes d'historique`);
await db.collection("priceBookDirty").doc("carrefour").set({ at: Date.now() });
console.log("Carnet de prix Carrefour : reconstruction demandée");
