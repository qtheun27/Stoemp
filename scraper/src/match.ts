import { norm } from "./parse.js";
import type { CatalogItem, Product, StoreId } from "./types.js";

const HOUSE: Record<string, string[]> = {
  colruyt: ["boni", "everyday"], delhaize: ["delhaize", "365"], carrefour: ["carrefour", "simpl"], ah: ["ah", "albert heijn"], renmans: ["renmans"],
};
const NEGATIVE = ["saveur", "arome", "gout", "chips", "biscuit", "bonbon", "sauce", "soupe", "aperitif", "snack", "bebe", "chat", "chien"];
const tokens = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !["de", "du", "la", "le", "les", "des", "et", "en", "au", "aux", "boite"].includes(w)).map((w) => w.replace(/s$/, ""));

/** Score de correspondance 0..1 entre un article générique et un produit d'enseigne. */
export function score(item: CatalogItem, p: Product): number {
  const pt = new Set(tokens(p.name));
  let best = 0;
  for (const n of [item.name, ...(item.aliases || [])]) {
    const it = tokens(n);
    if (!it.length) continue;
    best = Math.max(best, it.filter((w) => pt.has(w)).length / it.length);
  }
  const itemText = norm([item.name, ...(item.aliases || [])].join(" "));
  if (NEGATIVE.some((w) => pt.has(w) && !itemText.includes(w))) best *= 0.3;
  return best;
}

export const pricePerUnit = (p: Product) => (p.packSize ? p.price / p.packSize : Infinity);
export const isHouseBrand = (store: StoreId, p: Product) => (HOUSE[store] || []).some((h) => norm(`${p.brand || ""} ${p.name}`).includes(h));

export type Choice = { kind: "ok"; product: Product } | { kind: "ambiguous"; candidates: Product[] } | { kind: "none" };

/**
 * Choisit le produit : correspondance mémorisée si présente, sinon les bons candidats (score 1, même unité),
 * et parmi eux le prix au kilo/litre le plus bas (marque distributeur en cas d'égalité).
 */
export function choose(item: CatalogItem, store: StoreId, products: Product[], remembered?: string | null, organic = false): Choice {
  const usable = products.filter((p) => p.packUnit === item.unit && p.packSize && p.price > 0 && p.organic === organic);
  if (remembered) {
    const r = usable.find((p) => norm(p.name) === norm(remembered));
    if (r) return { kind: "ok", product: r };
  }
  const good = usable.filter((p) => score(item, p) >= 0.99);
  if (good.length) {
    good.sort((a, b) => pricePerUnit(a) - pricePerUnit(b) || Number(isHouseBrand(store, b)) - Number(isHouseBrand(store, a)));
    return { kind: "ok", product: good[0] };
  }
  const partial = usable.filter((p) => score(item, p) >= 0.5).slice(0, 10);
  return partial.length ? { kind: "ambiguous", candidates: partial } : { kind: "none" };
}
