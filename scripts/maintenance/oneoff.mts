// Tâche ponctuelle (workflow « Maintenance », oneoff) : corrige le classement de recettes écrites par l'IA (type de plat, durée).
// Puis lancer la tâche « library » pour reconstruire les fiches compactes.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { STARCH_RE } from "../../src/lib/balance";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const COURSE: Record<string, string> = {
  "Mì Quảng": "plat", "Cao lầu": "plat", "Hủ tiếu Nam Vang": "plat", "Pozole verde": "plat",
  "Sopa de tortilla": "soupe", "Asperges vertes à la flamande": "entree",
  ...Object.fromEntries(["Cookies aux pépites de chocolat", "Tarte au riz liégeoise", "Barfi au lait en poudre", "Ladoo au besan", "Motichoor ladoo",
    "Brutti ma buoni", "Cartellate", "Chiacchiere", "Ferratelle abruzzaises", "Frittelle veneziane", "Pasta di mandorla", "Pettole pugliesi", "Pinza veneta",
    "Struffoli", "Torta caprese", "Torta di mele umbra", "Torta di nocciole", "Torta di pere e cioccolato", "Torta sbrisolona", "Pastéis de nata",
    "Basboussa (revani)", "Chebakia", "Cornes de gazelle", "Kataïf aux noix", "Maamoul aux dattes", "Makrout", "Churros"].map((n) => [n, "patisserie"])),
};
const MINUTES: Record<string, number> = { "Baeckeoffe alsacien": 240, "Clafoutis limousin aux cerises noires": 60 };
const names = new Map((await db.collection("items").select("name").get()).docs.map((d) => [d.id, d.get("name") as string]));
const docs = (await db.collection("recipes").where("lib", "==", true).get()).docs.filter((d) => !d.get("deleted") && d.get("author") !== "chef");
let n = 0;
for (const d of docs) {
  const name = d.get("name") as string, patch: Record<string, unknown> = {};
  if (COURSE[name] && COURSE[name] !== (d.get("course") || "plat")) {
    patch.course = COURSE[name];
    const ings = [...(d.get("ingredients") || []), ...(d.get("meat") || [])] as { itemId: string }[];
    if (COURSE[name] === "plat") patch.light = !ings.some((i) => STARCH_RE.test(names.get(i.itemId) || ""));
  }
  if (MINUTES[name] && MINUTES[name] !== d.get("prepMin")) patch.prepMin = MINUTES[name];
  if (!Object.keys(patch).length) continue;
  await d.ref.set(patch, { merge: true }); n++;
  console.log(`${name} : ${JSON.stringify(patch)}`);
}
const missing = [...Object.keys(COURSE), ...Object.keys(MINUTES)].filter((k) => !docs.some((d) => d.get("name") === k));
console.log(`${n} recettes corrigées.${missing.length ? " Introuvables : " + missing.join(", ") : ""}`);
