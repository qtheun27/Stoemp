// Tâche ponctuelle (workflow « Maintenance », oneoff) : liste des recettes de la bibliothèque écrites par l'IA, en lecture seule.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const docs = (await getFirestore().collection("recipes").where("lib", "==", true).get()).docs.filter((d) => !d.get("deleted") && d.get("author") !== "chef");
console.log(`${docs.length} recettes IA`);
for (const d of docs.sort((a, b) => `${a.get("course")}${a.get("cuisine")}`.localeCompare(`${b.get("course")}${b.get("cuisine")}`)))
  console.log(`IA|${d.id}|${d.get("course") || "plat"}|${d.get("cuisine")}|${d.get("name")}|${d.get("prepMin")}|${d.get("light") ? "l" : ""}`);
