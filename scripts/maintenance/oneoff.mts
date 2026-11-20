// Tâche ponctuelle (workflow « Maintenance », oneoff) : LECTURE SEULE. Noms retenus (alias) d'articles qui attirent des produits
// sans rapport, et alias trop vagues (sans mot propre à un produit : seulement marque ou gamme).
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const items = (await db.collection("items").get()).docs;
for (const n of ["Pâtes", "Lait", "Yaourt nature", "Bière trappiste", "Granulés de chocolat au lait", "Pâte à tartiner", "Biscuits"]) {
  const d = items.find((x) => x.get("name") === n);
  if (d) console.log(`${n} : ${((d.get("aliases") || []) as string[]).join(" | ") || "(aucun)"}`);
}
const VAGUE = /^(carrefour|boni|colruyt|everyday|delhaize|simpl|extra|classic'?|original|bio|selection|sélection|premium|bon|le|la|les|de|du|des|\d+|x|g|kg|ml|cl|l|pièces?|\s|[.,'&+-])+$/i;
console.log("\nAlias trop vagues (seulement marque / gamme / chiffres) :");
for (const d of items) for (const a of (d.get("aliases") || []) as string[]) if (VAGUE.test(a.trim())) console.log(`  ${d.get("name")} : « ${a} »`);
