/**
 * Lecteur générique sans IA, pour les enseignes autres que Colruyt (zone des prix envoyée par le favori).
 * Deux dispositions courantes, reconnues automatiquement (la plus productive l'emporte) :
 *   A. prix d'abord (Renmans) :  « € 12,34 » / « /kg » / « Carbonnade de bœuf »
 *   B. nom d'abord :             « Carbonnade de bœuf » / « 500 g » / « 6,99 € » / « 13,98 €/kg »
 *      Variante carte (Carrefour, dans l'ordre du texte de la page, pas de l'affichage) : « Spa » / « REINE Eau minérale 6x1.5L » / « 4,99 € » / « 0,55 €/l »
 *      → marque ajoutée au nom, contenance lue dans le nom si elle concorde avec le prix au litre ou au kilo, sinon déduite de celui-ci.
 * Si aucune ne donne au moins 3 produits, l'IA prend le relais (lecture par morceaux).
 */
import type { ShopProduct } from "./colruyt";

const PRICE = /^(?:€\s?(\d+[.,]\d{2})|(\d+[.,]\d{2})\s?€)\s*(?:\/\s?(kg|kilo|pce|pc|pièce|piece|st|stuk|l|litre))?$/i;
const UNIT = /^(?:\/|par\s)\s?(kg|kilo|pce|pc|pièce|piece|st|stuk|l|litre)$/i;
const PACK = /^±?\s*(\d+(?:[.,]\d+)?)\s*(kg|g|gr|l|cl|ml|pc|pcs|pce|pièces?|st)$/i;
const NOISE = /^(ajouter|acheter|commander|voir|promo|promotion|action|nouveau|bio|top|exclusif|en stock|disponible|indisponible|-?\d+\s?%|\d+\+\d+.*|€.*|\/.*)$/i;
// Badges et mentions des cartes produits : jamais un nom (« -15% à l'achat de 3 », « 2ème à -30% », « 3 + 1 gratuit », « Recommandé »).
const BADGE = /^(ajouter|acheter|commander)\b|au panier|^-?\d+\s?%|^\d+\s?(e|è|ème|eme|de)\b|achetés?|gratuit|à l'achat|^recommandé|^la pièce$|^le kg$|^par pièce$|^nutri-?score|^sponsorisé|^nouveau$|^en promo|^\d[\d .]*\s(produits?|résultats?|articles?)\b|^résultats/i;
const num = (s: string) => Number(s.replace(",", "."));
const isName = (l: string) => l.length >= 3 && l.length <= 120 && /[a-zà-ÿ]{3}/i.test(l) && !NOISE.test(l) && !BADGE.test(l) && !PRICE.test(l) && !UNIT.test(l) && !PACK.test(l);

function unitPack(u: string | undefined): { size: number; unit: "g" | "ml" | "pc" } {
  const k = (u || "").toLowerCase();
  if (k === "kg" || k === "kilo") return { size: 1000, unit: "g" };
  if (k === "l" || k === "litre") return { size: 1000, unit: "ml" };
  return { size: 1, unit: "pc" };
}
function pack(line: string): { size: number; unit: "g" | "ml" | "pc" } | null {
  const p = line.match(PACK);
  if (!p) return null;
  const n = num(p[1]), u = p[2].toLowerCase();
  if (u === "kg") return { size: n * 1000, unit: "g" };
  if (u === "g" || u === "gr") return { size: n, unit: "g" };
  if (u === "l") return { size: n * 1000, unit: "ml" };
  if (u === "cl") return { size: n * 10, unit: "ml" };
  if (u === "ml") return { size: n, unit: "ml" };
  return { size: n, unit: "pc" };
}
const product = (name: string, price: number, p: { size: number; unit: "g" | "ml" | "pc" }): ShopProduct =>
  ({ name, price, packSize: p.size, packUnit: p.unit, pricePerUnit: price / p.size, promo: null, organic: /\bbio\b/i.test(name) });

/** A. Prix d'abord, puis l'unité éventuelle, puis le nom. */
function priceFirst(lines: string[]): ShopProduct[] {
  const out: ShopProduct[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(PRICE);
    if (!m) continue;
    let u = m[3], j = i + 1;
    if (!u && UNIT.test(lines[j] || "")) { u = lines[j].match(UNIT)![1]; j++; }
    if (lines[j] && isName(lines[j])) { out.push(product(lines[j], num(m[1] || m[2]), unitPack(u))); i = j; }
  }
  return out;
}
/** B. (Marque,) nom, contenance éventuelle, puis prix ; le prix au litre ou au kilo qui suit sert à trouver la contenance. */
function nameFirst(lines: string[]): ShopProduct[] {
  const out: ShopProduct[] = [];
  let names: string[] = [], size: ReturnType<typeof pack> = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], m = l.match(PRICE);
    if (m && names.length) {
      const price = num(m[1] || m[2]);
      const u = m[3] || (UNIT.test(l) ? l.match(UNIT)![1] : undefined);
      const last = names[names.length - 1], brand = names.length > 1 ? names[names.length - 2] : "";
      const name = brand && brand.length <= 30 && !last.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${last}` : last;
      let sz: { size: number; unit: "g" | "ml" | "pc" };
      if (u) sz = unitPack(u); // prix au kilo ou au litre : c'est le prix affiché
      else {
        const nx = (lines[i + 1] || "").match(PRICE), per = nx && nx[3] ? unitPack(nx[3]) : null;
        const fromPer = per && per.unit !== "pc" && num(nx![1] || nx![2]) > 0 ? { size: Math.round((price / num(nx![1] || nx![2])) * 1000), unit: per.unit } : null;
        const inName = size || sizeInName(last);
        sz = fromPer ? (inName && inName.unit === fromPer.unit && Math.abs(inName.size - fromPer.size) <= fromPer.size * 0.2 ? inName : fromPer) : inName || { size: 1, unit: "pc" };
        if (fromPer) i++; // le prix au litre/kilo est consommé
      }
      out.push(product(name, price, sz));
      names = []; size = null;
    } else if (!m && isName(l)) { names.push(l); size = null; }
    else if (names.length && pack(l)) size = pack(l);
  }
  return out;
}

/** Contenance lue dans le nom : « 6 x 1,5 L », « 24x33cl », « 1 kg », « 330 ml ». */
function sizeInName(name: string): { size: number; unit: "g" | "ml" | "pc" } | null {
  const m = name.match(/(?:(\d+)\s?[x×]\s?)?(\d+(?:[.,]\d+)?)\s?(kg|g|gr|l|cl|ml)\b/i);
  if (!m) return null;
  const p = pack(`${m[2]} ${m[3]}`);
  return p ? { size: p.size * (m[1] ? Number(m[1]) : 1), unit: p.unit } : null;
}
/** Produits lus sans IA dans le texte d'une page de magasin (doublons retirés). */
export function parseGeneric(text: string): ShopProduct[] {
  const lines = text.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const a = priceFirst(lines), b = nameFirst(lines);
  const best = a.length >= b.length ? a : b;
  const seen = new Set<string>();
  return best.filter((p) => { const k = `${p.name}|${p.price}|${p.packSize}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
