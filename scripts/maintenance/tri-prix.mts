// Tri des prix : retire des aliments les produits pour animaux, d'entretien, d'hygiène et de beauté rangés par erreur.
// Par défaut, ESSAI À BLANC : liste seulement ce qui serait retiré. APPLY=1 pour écrire (workflow Maintenance → tri-prix-appliquer).
// Touche : variantes et résumé des prix (prices), alias appris (items), historique (priceHistory) ; articles non alimentaires mal rangés → « Hygiène & entretien ».
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HOUSEHOLD, isBabyFood, isNonFood } from "../../functions/src/readers/nonfood";
import { rebuildPriceBook } from "../../functions/src/pricebook";
import { imagesThisMonth } from "../../functions/src/images";

const APPLY = process.env.APPLY === "1";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
console.log(APPLY ? "=== TRI APPLIQUÉ ===" : "=== ESSAI À BLANC (rien n'est modifié) ===");

// 1. Articles : alias non alimentaires sur un aliment, et articles non alimentaires rangés avec la nourriture.
const items = (await db.collection("items").get()).docs.map((d) => ({ ref: d.ref, id: d.id, name: d.get("name") as string, category: d.get("category") as string, aliases: (d.get("aliases") || []) as string[] }));
const cat = new Map(items.map((i) => [i.id, i.category]));
let nAlias = 0, nMoved = 0;
for (const it of items) {
  if (it.category === HOUSEHOLD) continue;
  if (isNonFood(it.name)) {
    nMoved++; console.log(`ARTICLE mal rangé → Hygiène & entretien : ${it.name} (était ${it.category})`);
    if (APPLY) { await it.ref.set({ category: HOUSEHOLD }, { merge: true }); cat.set(it.id, HOUSEHOLD); }
    continue;
  }
  const bad = it.aliases.filter((a) => isNonFood(a) || (isBabyFood(a) && !isBabyFood(it.name)));
  if (bad.length) {
    nAlias += bad.length; console.log(`ALIAS retirés de « ${it.name} » : ${bad.join(" · ")}`);
    if (APPLY) await it.ref.update({ aliases: FieldValue.arrayRemove(...bad) });
  }
}

// 2. Prix : variantes non alimentaires retirées d'un aliment ; résumé recalculé ; fiche supprimée s'il ne reste rien.
const prices = await db.collection("prices").get();
const stores = new Set<string>();
let nOffers = 0, nDocs = 0, nDeleted = 0;
const w = db.bulkWriter();
for (const d of prices.docs) {
  const p = d.data(), c = cat.get(p.itemId);
  if (!c || c === HOUSEHOLD) continue;
  const offers = (p.offers || []) as { name: string; organic: boolean; size: number; price: number; ppu: number; promo?: string | null }[];
  // Hors sujet pour cet aliment : non alimentaire, ou petit pot pour bébé rangé dans un ingrédient de cuisine.
  const itemName = items.find((i) => i.id === p.itemId)?.name || "";
  const wrong = (n: string) => isNonFood(n) || (isBabyFood(n) && !isBabyFood(itemName));
  const keep = offers.filter((o) => !wrong(o.name));
  const summaryBad = wrong(p.productName || "");
  if (keep.length === offers.length && !summaryBad) continue;
  const gone = offers.filter((o) => wrong(o.name)).map((o) => o.name);
  nOffers += gone.length; nDocs++; stores.add(p.store);
  const name = items.find((i) => i.id === p.itemId)?.name || p.itemId;
  if (!keep.length) {
    nDeleted++; console.log(`PRIX supprimé : ${name} @ ${p.store}${p.organic ? " (bio)" : ""} — ${[p.productName, ...gone].filter(Boolean).slice(0, 3).join(" · ")}`);
    if (APPLY) w.delete(d.ref);
    continue;
  }
  const best = (p.organic ? keep.find((o) => o.organic) : keep.find((o) => !o.organic)) || keep[0];
  console.log(`PRIX nettoyé : ${name} @ ${p.store} — retirés : ${(gone.length ? gone : [p.productName]).slice(0, 3).join(" · ")}${gone.length > 3 ? ` (+${gone.length - 3})` : ""} → garde « ${best.name} »`);
  if (APPLY) w.set(d.ref, { offers: keep, productName: best.name, packSize: best.size, packPrice: best.price, pricePerUnit: best.ppu, promo: best.promo ?? null }, { merge: true });
}

// 3. Historique des prix.
const hist = await db.collection("priceHistory").get();
let nHist = 0;
for (const d of hist.docs) {
  const c = cat.get(d.get("itemId"));
  const pn = d.get("productName") || "", inm = items.find((i) => i.id === d.get("itemId"))?.name || "";
  if (c && c !== HOUSEHOLD && (isNonFood(pn) || (isBabyFood(pn) && !isBabyFood(inm)))) { nHist++; if (APPLY) w.delete(d.ref); }
}
await w.close();

console.log(`\nBilan : ${nMoved} articles à ranger en Hygiène & entretien, ${nAlias} alias, ${nOffers} variantes de prix dans ${nDocs} fiches (dont ${nDeleted} fiches entières), ${nHist} lignes d'historique.`);
if (APPLY && nDocs) console.log(`Carnet de prix reconstruit : ${await rebuildPriceBook([...stores] as never, db as never)} fiches.`);

// Photos : où en est-on ?
const thumbs = new Set((await db.collection("dishThumbs").select().get()).docs.map((d) => d.id));
const recipes = (await db.collection("recipes").where("householdId", "==", null).get()).docs.filter((d) => !d.get("deleted") && d.get("source") !== "pret");
const plats = recipes.filter((d) => (d.get("course") || "plat") === "plat");
console.log(`\nPhotos : ${recipes.filter((d) => thumbs.has(d.id)).length} / ${recipes.length} recettes (plats principaux : ${plats.filter((d) => thumbs.has(d.id)).length} / ${plats.length}) ; ${await imagesThisMonth(db)} photos facturées ce mois-ci.`);
