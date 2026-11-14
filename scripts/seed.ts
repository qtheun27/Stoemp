// Remplit le catalogue partagé (articles + recettes de base) dans Firestore. Idempotent.
// Usage : GOOGLE_APPLICATION_CREDENTIALS=… npx tsx scripts/seed.ts
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { BASE_ITEMS, BASE_RECIPES } from "../src/lib/catalog";

initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const clean = <T,>(o: T) => JSON.parse(JSON.stringify(o));

async function main() {
  let b = db.batch(), n = 0;
  const flush = async () => { await b.commit(); b = db.batch(); n = 0; };
  for (const i of BASE_ITEMS) { b.set(db.collection("items").doc(i.id), clean(i)); if (++n >= 400) await flush(); }
  for (const r of BASE_RECIPES) { b.set(db.collection("recipes").doc(r.id), clean({ ...r, householdId: null, deleted: false })); if (++n >= 400) await flush(); }
  await flush();
  console.log(`${BASE_ITEMS.length} articles et ${BASE_RECIPES.length} recettes écrits.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
