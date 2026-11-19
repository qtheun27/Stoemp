// Tâche ponctuelle (workflow « Maintenance », oneoff) : bilan des photos des plats, en lecture seule (aucune écriture, aucun appel payant).
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
const logs = (await db.collection("aiLogs").where("task", "==", "dishImage").get()).docs.map((d) => d.data()).filter((l) => (l.at || 0) >= start);
const ok = logs.filter((l) => (l.cost || 0) > 0), err = logs.filter((l) => l.error);
console.log(`Ce mois-ci : ${ok.length} photos facturées (≈ ${ok.reduce((s, l) => s + l.cost, 0).toFixed(2)} $), ${err.length} refus (non facturés).`);
const thumbs = new Set((await db.collection("dishThumbs").select().get()).docs.map((d) => d.id));
const shared = (await db.collection("recipes").where("householdId", "==", null).get()).docs.filter((d) => !d.get("deleted") && d.get("source") !== "pret");
const plats = shared.filter((d) => (d.get("course") || "plat") === "plat");
console.log(`Photos rangées : ${thumbs.size}. Recettes visibles : ${shared.length} (${shared.filter((d) => thumbs.has(d.id)).length} avec photo) ; plats principaux : ${plats.length} (${plats.filter((d) => thumbs.has(d.id)).length} avec photo).`);
console.log(`Photos sur des fiches masquées (à recopier) : ${[...thumbs].filter((id) => !shared.some((d) => d.id === id)).length}.`);
