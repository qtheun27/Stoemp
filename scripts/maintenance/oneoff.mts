// Tâche ponctuelle (workflow « Maintenance », oneoff) : rappels, vérification EN LECTURE SEULE (aucun jeton affiché).
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const key = (await db.collection("config").doc("app").get()).get("vapidKey") as string | undefined;
console.log(`Clé push Web : ${key ? `présente (${key.length} caractères, commence par « ${key[0]} »)` : "absente"}`);
const devs = (await db.collectionGroup("devices").get()).docs;
console.log(`Téléphones inscrits : ${devs.length}`);
for (const d of devs) {
  const r = d.get("reminders") || {}, ua = String(d.get("ua") || "");
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "autre";
  console.log(`  ${os} · foyer ${d.get("hid") ? "relié" : "absent"} · jeton ${d.get("token") ? "présent" : "absent"} · courses ${r.courses ? "oui" : "non"}, péremption ${r.peremption ? "oui" : "non"}, soir ${r.soir ? "oui" : "non"}`);
}
