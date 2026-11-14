import { STORES } from "./constants";
import type { Item, PaidPrice, Price, StoreId } from "./types";
import { packsFor } from "./units";

export interface PriceInfo {
  store: StoreId;
  pricePerUnit: number; // € par g, ml ou pièce
  packSize: number;
  packPrice: number;
  organic: boolean;
  source: Price["source"] | "payé" | "estimation";
  date?: string;
  promo?: string | null;
  productName?: string;
  url?: string;
}

export interface PriceBook {
  shared: Map<string, Price>; // clé itemId_store ou itemId_store_bio
  paid: Map<string, PaidPrice>; // clé itemId_store
}
export const emptyBook = (): PriceBook => ({ shared: new Map(), paid: new Map() });
export const priceKey = (itemId: string, store: StoreId, organic = false) => `${itemId}_${store}${organic ? "_bio" : ""}`;

/** Le magasin vend-il ce rayon ? (Renmans : boucherie, charcuterie, fromage, traiteur.) */
export const storeSells = (store: StoreId, item: Item) => !STORES[store].only || STORES[store].only!.includes(item.category);

/**
 * Meilleur prix connu d'un article dans une enseigne.
 * Priorité : prix payé s'il est plus récent, puis prix relevé (robot, capture, ticket), puis estimation de démo.
 */
export function priceAt(item: Item, store: StoreId, book: PriceBook, organic = false): PriceInfo | null {
  if (!storeSells(store, item)) return null;
  const shared = (organic && book.shared.get(priceKey(item.id, store, true))) || book.shared.get(priceKey(item.id, store));
  const paid = book.paid.get(priceKey(item.id, store));
  if (paid && (!shared || paid.date >= shared.fetchedAt.slice(0, 10))) {
    return { store, pricePerUnit: paid.pricePerUnit, packSize: paid.packSize, packPrice: paid.packPrice, organic: false, source: "payé", date: paid.date };
  }
  if (shared) {
    return {
      store, pricePerUnit: shared.pricePerUnit, packSize: shared.packSize, packPrice: shared.packPrice, organic: shared.organic,
      source: shared.source, date: shared.fetchedAt.slice(0, 10), promo: shared.promo, productName: shared.productName, url: shared.url,
    };
  }
  const bio = organic && item.organicAvailable ? 1.35 : 1;
  const packPrice = Math.round(item.demoPrice * STORES[store].factor * bio * 100) / 100;
  return { store, pricePerUnit: packPrice / item.packSize, packSize: item.packSize, packPrice, organic: bio > 1, source: "estimation" };
}

/** Prix retenu : magasin préféré, ou le moins cher parmi les magasins fréquentés. */
export function bestPrice(item: Item, stores: StoreId[], pref: StoreId | "cheapest", book: PriceBook, organic = false): PriceInfo | null {
  if (pref !== "cheapest") {
    const p = priceAt(item, pref, book, organic);
    if (p) return p;
  }
  let best: PriceInfo | null = null;
  for (const s of stores) {
    const p = priceAt(item, s, book, organic);
    if (p && (!best || p.pricePerUnit < best.pricePerUnit)) best = p;
  }
  return best;
}

/** Coût d'achat d'une quantité, arrondi aux paquets entiers. */
export const lineCost = (qty: number, p: PriceInfo) => packsFor(qty, p.packSize) * p.packPrice;
