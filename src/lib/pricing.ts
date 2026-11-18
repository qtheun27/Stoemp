import { STORES } from "./constants";
import type { Allergen, Item, Offer, PaidPrice, Price, PriceRange, StoreId, Unit } from "./types";
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
  shop?: string | null;
}

/** Préférences du foyer qui orientent le choix de la variante (et donc le budget). */
export interface PriceSel { organic: boolean; range: PriceRange; allergens: Allergen[] }
export const DEFAULT_SEL: PriceSel = { organic: false, range: "maison", allergens: [] };
const toSel = (s: PriceSel | boolean | undefined): PriceSel => (typeof s === "object" ? s : { ...DEFAULT_SEL, organic: !!s });

/** Allergène de l'article → étiquette de la variante qui l'évite. */
const FREE_OF: Partial<Record<Allergen, string>> = { gl: "sans-gluten", la: "sans-lactose" };

/**
 * Choisit la variante qui correspond au foyer : sans allergène si nécessaire, bio si demandé,
 * puis la gamme (premier prix = la moins chère ; marque du magasin ; grandes marques). Repli raisonnable si la gamme manque.
 */
export function pickOffer(item: Item, offers: Offer[], sel: PriceSel): Offer | null {
  if (!offers.length) return null;
  let c = offers;
  for (const a of sel.allergens) {
    const tag = FREE_OF[a];
    if (!tag || !item.allergens.includes(a)) continue;
    const free = c.filter((o) => o.tags.includes(tag));
    if (free.length) c = free;
  }
  if (sel.organic) { const bio = c.filter((o) => o.organic); if (bio.length) c = bio; }
  else { const plain = c.filter((o) => !o.organic); if (plain.length) c = plain; }
  const byPpu = [...c].sort((a, b) => a.ppu - b.ppu);
  if (sel.range === "eco") return byPpu[0];
  const tier = byPpu.filter((o) => o.tier === sel.range);
  if (tier.length) return tier[0];
  // Repli : marque du magasin → médiane ; grandes marques → la plus chère des variantes connues.
  return sel.range === "marque" ? byPpu[byPpu.length - 1] : byPpu[Math.floor((byPpu.length - 1) / 2)];
}

export interface PriceBook {
  shared: Map<string, Price>; // clé itemId_store ou itemId_store_bio
  paid: Map<string, PaidPrice>; // clé itemId_store
}
export const emptyBook = (): PriceBook => ({ shared: new Map(), paid: new Map() });

/** Entrée du carnet de prix compact (documents « priceBook/{magasin}_{n} », voir functions/src/pricebook.ts). */
export interface BookEntry { i: string; b: 0 | 1; n: string; z: number; un: Unit; p: number; u: number; pr: string | null; d: string; src: Price["source"]; sh: string | null; url?: string;
  f?: [string, PriceRange, 0 | 1, string, number, number, string | null][] }

/** Déplie les documents du carnet en fiches de prix (clé = identifiant de la fiche). */
export function expandBook(docs: { store: StoreId; e: Record<string, BookEntry> }[]): Map<string, Price> {
  const out = new Map<string, Price>();
  for (const { store, e } of docs) for (const [key, x] of Object.entries(e || {})) {
    out.set(key, {
      itemId: x.i, store, organic: !!x.b, productName: x.n, packSize: x.z, packUnit: x.un, packPrice: x.p, pricePerUnit: x.u, promo: x.pr, fetchedAt: x.d,
      source: x.src, shop: x.sh, url: x.url,
      offers: x.f?.map(([name, tier, organic, tags, size, price, promo]) => ({ name, tier, organic: !!organic, tags: tags ? tags.split(",") : [], size, price, ppu: price / (size || 1), promo })),
    });
  }
  return out;
}
export const priceKey = (itemId: string, store: StoreId, organic = false) => `${itemId}_${store}${organic ? "_bio" : ""}`;

/** Le magasin vend-il ce rayon ? (Renmans : boucherie, charcuterie, fromage, traiteur.) */
export const storeSells = (store: StoreId, item: Item) => !STORES[store].only || STORES[store].only!.includes(item.category);

/**
 * Meilleur prix connu d'un article dans une enseigne.
 * Priorité : prix payé s'il est plus récent, puis prix relevé (robot, capture, ticket), puis estimation de démo.
 */
export function priceAt(item: Item, store: StoreId, book: PriceBook, selection: PriceSel | boolean = false): PriceInfo | null {
  if (!storeSells(store, item)) return null;
  const sel = toSel(selection);
  const organic = sel.organic;
  const shared = (organic && book.shared.get(priceKey(item.id, store, true))) || book.shared.get(priceKey(item.id, store));
  const paid = book.paid.get(priceKey(item.id, store));
  if (paid && (!shared || paid.date >= shared.fetchedAt.slice(0, 10))) {
    return { store, pricePerUnit: paid.pricePerUnit, packSize: paid.packSize, packPrice: paid.packPrice, organic: false, source: "payé", date: paid.date };
  }
  if (shared?.offers?.length) {
    const o = pickOffer(item, shared.offers, sel);
    if (o) return { store, pricePerUnit: o.ppu, packSize: o.size, packPrice: o.price, organic: o.organic, source: shared.source,
      date: shared.fetchedAt.slice(0, 10), promo: o.promo, productName: o.name, url: shared.url, shop: shared.shop };
  }
  if (shared) {
    return {
      store, pricePerUnit: shared.pricePerUnit, packSize: shared.packSize, packPrice: shared.packPrice, organic: shared.organic,
      source: shared.source, date: shared.fetchedAt.slice(0, 10), promo: shared.promo, productName: shared.productName, url: shared.url, shop: shared.shop,
    };
  }
  const bio = organic && item.organicAvailable ? 1.35 : 1;
  const packPrice = Math.round(item.demoPrice * STORES[store].factor * bio * 100) / 100;
  return { store, pricePerUnit: packPrice / item.packSize, packSize: item.packSize, packPrice, organic: bio > 1, source: "estimation" };
}

/** Prix retenu : magasin préféré, ou le moins cher parmi les magasins fréquentés. */
export function bestPrice(item: Item, stores: StoreId[], pref: StoreId | "cheapest", book: PriceBook, organic: PriceSel | boolean = false): PriceInfo | null {
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
