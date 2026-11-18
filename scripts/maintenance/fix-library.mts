// Maintenance ponctuelle (novembre 2026) : à lancer une fois via le workflow « Maintenance », puis à supprimer.
// Corrige la bibliothèque déjà générée : plats complétés de leur accompagnement, doublons masqués, entrées reclassées.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const apply = true;
const ADD: Record<string, [string, number, string]> = {
  "lib-anguilles-au-vert": ["frites-surgelees", 200, "Servir avec des frites ou du pain."],
  "lib-pintade-a-la-biere": ["pommes-de-terre", 250, "Servir avec des pommes de terre vapeur ou une purée."],
  "lib-poulet-vallee-d-auge": ["pommes-de-terre", 200, "Servir avec des pommes de terre sautées."],
  "lib-boeuf-carottes": ["pommes-de-terre", 200, "Servir avec des pommes de terre vapeur."],
  "lib-escalope-de-veau-a-la-creme": ["pates", 90, "Servir avec des tagliatelles cuites al dente."],
  "lib-poulet-roti-aux-herbes-de-provence": ["pommes-de-terre", 250, "Rôtir des pommes de terre en quartiers autour du poulet pendant les 45 dernières minutes."],
  "lib-roti-de-porc-au-lait": ["pommes-de-terre", 250, "Servir avec une purée de pommes de terre."],
  "lib-cotes-de-porc-charcutiere": ["pommes-de-terre", 250, "Servir avec une purée de pommes de terre."],
  "lib-machher-jhol-cabillaud-au-jhol-bengali": ["riz-basmati", 70, "Servir avec du riz basmati."],
  "lib-bistecca-alla-pizzaiola": ["pain-de-campagne", 0.25, "Servir avec du pain pour saucer."],
  "lib-pesce-all-acqua-pazza": ["pain-de-campagne", 0.25, "Servir avec du pain grillé."],
  "lib-chiles-en-nogada": ["riz", 60, "Servir avec du riz blanc."],
  "lib-birria-de-res": ["tortillas", 3, "Servir en tacos dans des tortillas chaudes, avec le bouillon à part pour tremper."],
  "lib-carnitas-de-michoacan": ["tortillas", 3, "Servir dans des tortillas chaudes avec oignon et coriandre."],
};
const HIDE = ["lib-boulettes-a-la-liegeoise", "lib-stoofvlees", "lib-steak-frites", "lib-tom-kha-gai", "lib-harira", "lib-minestrone-alla-milanese"];
const COURSE: Record<string, string> = { "lib-nems": "entree", "lib-rouleaux-de-printemps": "entree" };
for (const id of [...Object.keys(ADD), ...HIDE, ...Object.keys(COURSE)]) if (!(await db.collection("recipes").doc(id).get()).exists) console.log("introuvable :", id);
if (!apply) { console.log("essai à blanc"); process.exit(0); }
const b = db.batch();
for (const [id, [item, q, step]] of Object.entries(ADD)) {
  const r = (await db.collection("recipes").doc(id).get()).data()!;
  b.update(db.collection("recipes").doc(id), { ingredients: [...r.ingredients, { itemId: item, qtyPerPerson: q }], steps: [...r.steps, step] });
}
for (const id of HIDE) b.update(db.collection("recipes").doc(id), { deleted: true });
for (const [id, k] of Object.entries(COURSE)) b.update(db.collection("recipes").doc(id), { course: k });
// Fiches compactes de l'appli.
for (const d of (await db.collection("library").get()).docs) {
  const r = (d.get("r") as any[]).filter((e) => !HIDE.includes(e.i)).map((e) => ADD[e.i] ? { ...e, g: [...e.g, [ADD[e.i][0], ADD[e.i][1]]] } : COURSE[e.i] ? { ...e, k: COURSE[e.i] } : e);
  b.update(d.ref, { r });
}
await b.commit();
console.log("bibliothèque corrigée :", Object.keys(ADD).length, "plats complétés,", HIDE.length, "doublons masqués,", Object.keys(COURSE).length, "reclassés");
