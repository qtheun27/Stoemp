// Remplit le catalogue partagé (articles + recettes de base) dans Firestore. Idempotent et sans perte :
// un article existant garde ses alias appris et ses réglages (on n'ajoute que les alias de base),
// une recette de base masquée dans la console reste masquée.
// Usage : GOOGLE_APPLICATION_CREDENTIALS=… npx tsx scripts/seed.ts
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { BASE_ITEMS, BASE_RECIPES } from "../src/lib/catalog";

initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const clean = <T,>(o: T) => JSON.parse(JSON.stringify(o));

async function main() {
  let b = db.batch(), n = 0;
  const flush = async () => { await b.commit(); b = db.batch(); n = 0; };
  const items = new Set((await db.collection("items").select().get()).docs.map((d) => d.id));
  const recipes = new Set((await db.collection("recipes").where("householdId", "==", null).select().get()).docs.map((d) => d.id));
  let newItems = 0, newRecipes = 0;
  for (const i of BASE_ITEMS) {
    const ref = db.collection("items").doc(i.id);
    if (items.has(i.id)) { if (i.aliases.length) b.set(ref, { aliases: FieldValue.arrayUnion(...i.aliases) }, { merge: true }); else continue; }
    else { b.set(ref, clean(i)); newItems++; }
    if (++n >= 400) await flush();
  }
  for (const r of BASE_RECIPES) {
    const { id, ...rest } = r;
    // Contenu à jour ; « deleted » n'est écrit que pour une nouvelle recette.
    b.set(db.collection("recipes").doc(id), clean({ ...rest, householdId: null, ...(recipes.has(id) ? {} : { deleted: false }) }), { merge: true });
    if (!recipes.has(id)) newRecipes++;
    if (++n >= 400) await flush();
  }
  await flush();
  console.log(`${newItems} nouveaux articles (${BASE_ITEMS.length} au total), ${newRecipes} nouvelles recettes (${BASE_RECIPES.length} au total).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
