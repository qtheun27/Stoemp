// Tâche ponctuelle (workflow « Maintenance », oneoff) : supprime définitivement les recettes de la bibliothèque masquées comme doublons.
// Leurs noms restent dans le plan du générateur (libraryPlan), qui ne les reproposera donc pas.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const hidden = (await db.collection("recipes").where("lib", "==", true).where("deleted", "==", true).get()).docs;
const batch = db.batch();
for (const d of hidden) batch.delete(d.ref);
await batch.commit();
console.log(`${hidden.length} recettes masquées supprimées : ${hidden.map((d) => d.get("name")).join(", ") || "aucune"}.`);
