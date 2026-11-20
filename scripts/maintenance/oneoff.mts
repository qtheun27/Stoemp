// Tâche ponctuelle (workflow « Maintenance », oneoff) : avancement de la file Carrefour (lecture), puis correction de deux
// rangements faux : le nom du produit est retiré des alias de l'article et son offre retirée de la fiche de prix Carrefour.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
for (const d of (await db.collection("enrichJobs").get()).docs) console.log(`File d'attente : ${d.get("store")} · ${d.get("pos")}/${(d.get("products") || []).length}${d.get("paused") ? ` · en pause (${d.get("paused")})` : ""}`);
const since = new Date(Date.now() - 3 * 3600_000).toISOString();
console.log(`Fiches de prix Carrefour (3 h) : ${(await db.collection("prices").where("store", "==", "carrefour").get()).docs.filter((d) => String(d.get("fetchedAt")) >= since).length}`);

const WRONG: [RegExp, string][] = [[/Cristal Roc Eau de Source/i, "Bière sans alcool"], [/Jacqmotte Café Grains/i, "Biscuits"]];
const items = (await db.collection("items").get()).docs;
for (const [re, itemName] of WRONG) {
  const it = items.find((d) => d.get("name") === itemName);
  if (!it) { console.log(`Article « ${itemName} » introuvable`); continue; }
  const bad = ((it.get("aliases") || []) as string[]).filter((a) => re.test(a));
  if (bad.length) await it.ref.update({ aliases: FieldValue.arrayRemove(...bad) });
  const pref = db.collection("prices").doc(`${it.id}_carrefour`), p = await pref.get();
  if (p.exists) {
    const offers = ((p.get("offers") || []) as { name: string; ppu: number; organic: boolean; price: number; size: number; promo: string | null }[]).filter((o) => !re.test(o.name));
    if (!offers.length) await pref.delete();
    else { const best = offers.find((o) => !o.organic) || offers[0]; await pref.update({ offers, productName: best.name, packSize: best.size, packPrice: best.price, pricePerUnit: best.ppu, promo: best.promo }); }
  }
  console.log(`« ${itemName} » : ${bad.length} alias retiré(s), offre retirée de la fiche Carrefour`);
}
await db.collection("priceBookDirty").doc("carrefour").set({ at: Date.now() });
