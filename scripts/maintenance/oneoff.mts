// Tâche ponctuelle (workflow « Maintenance », oneoff) : viandes rangées sous l'article d'un autre animal.
// 1. Retire, partout, les alias et les produits relevés dont les animaux ne sont pas ceux de l'article (sameProteins).
// 2. « Steak haché nature boeuf » (Renmans) devient un nom du « Haché de bœuf ».
// 3. Relit la dernière page Renmans : les produits retirés retrouvent un bon article. Aucun prix affiché.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { sameProteins } from "../../functions/src/readers/match";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const items = (await db.collection("items").get()).docs;
const byId = new Map(items.map((d) => [d.id, d]));
let aliases = 0, offers = 0;
for (const d of items) {
  const bad = ((d.get("aliases") || []) as string[]).filter((a) => !sameProteins(a, d.get("name")));
  if (bad.length) { await d.ref.update({ aliases: FieldValue.arrayRemove(...bad) }); aliases += bad.length; console.log(`  ${d.get("name")} : alias retirés → ${bad.join(" | ")}`); }
}
const dirty = new Set<string>();
for (const p of (await db.collection("prices").get()).docs) {
  const it = byId.get(p.get("itemId"));
  if (!it) continue;
  const all = (p.get("offers") || []) as { name: string; ppu: number; organic: boolean; price: number; size: number; promo: string | null }[];
  const keep = all.filter((o) => sameProteins(o.name, it.get("name")));
  if (keep.length === all.length) continue;
  offers += all.length - keep.length; dirty.add(p.get("store"));
  console.log(`  ${it.get("name")} (${p.get("store")}) : produits retirés → ${all.filter((o) => !keep.includes(o)).map((o) => o.name).join(" | ")}`);
  if (!keep.length) await p.ref.delete();
  else { const best = keep.find((o) => !o.organic) || keep[0]; await p.ref.update({ offers: keep, productName: best.name, packSize: best.size, packPrice: best.price, pricePerUnit: best.ppu, promo: best.promo }); }
}
console.log(`Alias retirés : ${aliases} · produits retirés : ${offers}`);
const hache = items.find((d) => d.get("name") === "Haché de bœuf");
if (hache) { await hache.ref.update({ aliases: FieldValue.arrayUnion("Steak haché nature boeuf") }); console.log("« Steak haché nature boeuf » → Haché de bœuf"); }
for (const st of dirty) await db.collection("priceBookDirty").doc(st).set({ at: Date.now() });
const cap = (await db.collection("captures").orderBy("at", "desc").limit(30).select("store", "at").get()).docs.find((c) => c.get("store") === "renmans");
if (cap) {
  const ref = await db.collection("captureReplays").add({ captureId: cap.id, at: Date.now() });
  for (let i = 0; i < 54; i++) {
    await new Promise((r) => setTimeout(r, 10_000));
    const r = (await ref.get()).data()!;
    if (r.doneAt || r.error) { console.log(r.error ? `Relecture Renmans : erreur ${r.error}` : `Relecture Renmans : ${r.found} lus, ${r.saved} articles avec prix, ${r.created} nouveaux articles, ${r.queued} en file`); break; }
  }
}
