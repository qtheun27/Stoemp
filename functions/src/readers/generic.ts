/**
 * Lecteur générique sans IA, pour les enseignes autres que Colruyt (zone des prix envoyée par le favori).
 * Deux dispositions courantes, reconnues automatiquement (la plus productive l'emporte) :
 *   A. prix d'abord (Renmans) :  « € 12,34 » / « /kg » / « Carbonnade de bœuf »
 *   B. nom d'abord :             « Carbonnade de bœuf » / « 500 g » / « 6,99 € » / « 13,98 €/kg »
 * Si aucune ne donne au moins 3 produits, l'IA prend le relais (lecture par morceaux).
 */
import type { ShopProduct } from "./colruyt";

const PRICE = /^(?:€\s?(\d+[.,]\d{2})|(\d+[.,]\d{2})\s?€)\s*(?:\/\s?(kg|kilo|pce|pc|pièce|piece|st|stuk|l|litre))?$/i;
const UNIT = /^(?:\/|par\s)\s?(kg|kilo|pce|pc|pièce|piece|st|stuk|l|litre)$/i;
const PACK = /^±?\s*(\d+(?:[.,]\d+)?)\s*(kg|g|gr|l|cl|ml|pc|pcs|pce|pièces?|st)$/i;
const NOISE = /^(ajouter|acheter|commander|voir|promo|promotion|action|nouveau|bio|top|exclusif|en stock|disponible|indisponible|-?\d+\s?%|\d+\+\d+.*|€.*|\/.*)$/i;
const num = (s: string) => Number(s.replace(",", "."));
const isName = (l: string) => l.length >= 3 && l.length <= 120 && /[a-zà-ÿ]{3}/i.test(l) && !NOISE.test(l) && !PRICE.test(l) && !UNIT.test(l) && !PACK.test(l);

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
/** B. Nom, contenance éventuelle, puis prix (le prix au kilo qui suit est ignoré : on garde le prix payé). */
function nameFirst(lines: string[]): ShopProduct[] {
  const out: ShopProduct[] = [];
  let name: string | null = null, size: ReturnType<typeof pack> = null;
  for (const l of lines) {
    const m = l.match(PRICE);
    if (m && name) {
      const u = m[3] || (UNIT.test(l) ? l.match(UNIT)![1] : undefined);
      out.push(product(name, num(m[1] || m[2]), u ? unitPack(u) : size || { size: 1, unit: "pc" }));
      name = null; size = null;
    } else if (!m && isName(l)) { name = l; size = null; }
    else if (name && pack(l)) size = pack(l);
  }
  return out;
}

/** Produits lus sans IA dans le texte d'une page de magasin (doublons retirés). */
export function parseGeneric(text: string): ShopProduct[] {
  const lines = text.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const a = priceFirst(lines), b = nameFirst(lines);
  const best = a.length >= b.length ? a : b;
  const seen = new Set<string>();
  return best.filter((p) => { const k = `${p.name}|${p.price}|${p.packSize}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
