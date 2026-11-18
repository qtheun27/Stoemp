// Tâche ponctuelle (workflow « Maintenance », oneoff) : part de la semaine inventée par l'IA ramenée à 15 %.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const ref = getFirestore().collection("config").doc("app");
const before = (await ref.get()).get("aiWeekShare");
await ref.set({ aiWeekShare: 0.15 }, { merge: true });
console.log(`Part IA de la semaine : ${before ?? "non définie"} → 0.15`);
