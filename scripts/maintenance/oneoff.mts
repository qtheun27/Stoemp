// Correction ponctuelle (lancée via le workflow « Maintenance », tâche oneoff) : les chiles en nogada se servent seuls.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const id = "lib-chiles-en-nogada";
const ref = db.collection("recipes").doc(id);
const r = (await ref.get()).data()!;
await ref.update({ ingredients: r.ingredients.filter((i: { itemId: string }) => i.itemId !== "riz"), steps: r.steps.filter((s: string) => s !== "Servir avec du riz blanc."), light: true });
for (const d of (await db.collection("library").get()).docs) {
  const list = d.get("r") as { i: string; g: [string, number][] }[];
  if (!list.some((e) => e.i === id)) continue;
  await d.ref.update({ r: list.map((e) => (e.i === id ? { ...e, g: e.g.filter(([it]) => it !== "riz"), lt: 1 } : e)) });
}
console.log("chiles en nogada : servis seuls (repas complet), riz retiré.");
