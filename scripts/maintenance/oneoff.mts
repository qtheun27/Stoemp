// Tâche ponctuelle (workflow « Maintenance », oneoff) : nettoyage des rangements faussés.
// A. Noms retenus faits seulement d'une marque ou d'une gamme (« Carrefour Bio ») : retirés.
// B. Articles qui avaient un tel nom : leurs produits relevés sont revérifiés (correspondance sans ce nom), les autres retirés.
// C. « Bière trappiste » : noms et produits qui ne sont pas des bières d'abbaye ou trappistes retirés (réponses décalées de l'IA).
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { matchItem, tokens } from "../../functions/src/readers/match";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
type Off = { name: string; size: number; ppu: number; organic: boolean; price: number; promo: string | null };
const items = (await db.collection("items").get()).docs;
const touched = new Set<string>();
async function filterOffers(itemId: string, keep: (o: Off) => boolean, label: string) {
  for (const p of (await db.collection("prices").where("itemId", "==", itemId).get()).docs) {
    const all = (p.get("offers") || []) as Off[], ok = all.filter(keep);
    if (ok.length === all.length) continue;
    touched.add(p.get("store"));
    console.log(`  ${label} (${p.get("store")}) : ${all.length - ok.length} produits retirés — ${all.filter((o) => !ok.includes(o)).slice(0, 8).map((o) => o.name).join(" | ")}${all.length - ok.length > 8 ? " …" : ""}`);
    if (!ok.length) await p.ref.delete();
    else { const b = ok.find((o) => !o.organic) || ok[0]; await p.ref.update({ offers: ok, productName: b.name, packSize: b.size, packPrice: b.price, pricePerUnit: b.ppu, promo: b.promo }); }
  }
}
for (const d of items) {
  const al = (d.get("aliases") || []) as string[], vague = al.filter((a) => !tokens(a).length);
  if (!vague.length) continue;
  const clean = al.filter((a) => !vague.includes(a));
  await d.ref.update({ aliases: FieldValue.arrayRemove(...vague) });
  console.log(`A. ${d.get("name")} : noms vagues retirés → ${vague.join(" | ")}`);
  const it = { id: d.id, ...(d.data() as object), aliases: clean } as never;
  await filterOffers(d.id, (o) => !!matchItem(o.name, o.size, (d.get("unit") as "g" | "ml" | "pc"), [it]), `B. ${d.get("name")}`);
}
const ABBEY = /trapp|tripel|triple|dubbel|double|quadru|abba|abdij|chimay|westmalle|orval|rochefort|la trappe|karmeliet|feuillien|grimbergen|maredsous|petrus|kasteel|carolus|val-dieu|lupulus|hubertus|ename|delirium|kwak|straffe|curtius|bertinchamps|brugse|paix dieu|lefort|sportzot|waterloo|bière|biere|beer/i;
const trap = items.find((d) => d.get("name") === "Bière trappiste");
if (trap) {
  const bad = ((trap.get("aliases") || []) as string[]).filter((a) => !ABBEY.test(a));
  if (bad.length) await trap.ref.update({ aliases: FieldValue.arrayRemove(...bad) });
  console.log(`C. Bière trappiste : noms retirés → ${bad.join(" | ")}`);
  await filterOffers(trap.id, (o) => ABBEY.test(o.name), "C. Bière trappiste");
}
for (const st of touched) await db.collection("priceBookDirty").doc(st).set({ at: Date.now() });
console.log(`Carnets de prix à reconstruire : ${[...touched].join(", ") || "aucun"}`);
