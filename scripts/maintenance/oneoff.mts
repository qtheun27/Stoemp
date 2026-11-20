// Tâche ponctuelle (workflow « Maintenance », oneoff) : EN LECTURE SEULE, ordre des lignes de la dernière capture Carrefour
// (chiffres masqués : aucun prix dans le journal public) et avancement de la file d'attente.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const mask = (s: string) => s.replace(/\d/g, "#").slice(0, 100);
const c = (await db.collection("captures").orderBy("at", "desc").limit(10).get()).docs.map((d) => d.data()).find((x) => x.store === "carrefour");
if (c) {
  const lines = String(c.text).split("\n").map((l) => l.trim()).filter(Boolean);
  console.log(`Capture du ${new Date(c.at).toISOString()} : ${lines.length} lignes`);
  console.log("Lignes 1 à 90 :\n" + lines.slice(0, 90).map((l, i) => `${String(i + 1).padStart(3)} ${mask(l)}`).join("\n"));
  const k = lines.findIndex((l) => /Cristal Roc/i.test(l));
  if (k >= 0) console.log("\nAutour de « Cristal Roc » :\n" + lines.slice(k - 14, k + 6).map((l, i) => `${String(k - 13 + i).padStart(5)} ${mask(l)}`).join("\n"));
}
for (const d of (await db.collection("enrichJobs").get()).docs) console.log(`\nFile d'attente : ${d.get("store")} · ${d.get("pos")}/${(d.get("products") || []).length}`);
