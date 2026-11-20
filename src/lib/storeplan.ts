// Répartition des courses entre magasins : un magasin principal, des rayons à part (« Viande → Renmans »)
// et des articles à part (« Mirin → Carrefour »), retenus pour les semaines suivantes (`prefs.storePlan`).
import { STORES } from "./constants";
import type { ItemIndex } from "./catalog";
import { lineCost, priceAt, type PriceBook, type PriceSel } from "./pricing";
import type { Cat, Item, StoreId, Unit } from "./types";

export interface StorePlan { main?: StoreId; cats?: Partial<Record<Cat, StoreId>>; items?: Record<string, StoreId> }
export interface PlanLine { id: string; itemId: string | null; category: Cat; qty: number; unit: Unit | "" }
export interface PlanCtx { idx: ItemIndex; book: PriceBook; organic: PriceSel | boolean }

/** Magasin principal : celui choisi, sinon le premier des magasins du foyer. */
export const mainStore = (plan: StorePlan | undefined, stores: StoreId[]): StoreId =>
  plan?.main && stores.includes(plan.main) ? plan.main : stores[0] || "colruyt";

/**
 * Un magasin spécialisé (Renmans : boucherie) ne vend que son rayon, sans poisson ni fruits de mer
 * (sauf si on y a relevé un prix pour l'article) ; les autres magasins vendent tout.
 */
export function sells(item: Item | undefined, cat: Cat, store: StoreId, ctx: PlanCtx): boolean {
  const only = STORES[store].only;
  if (!only) return true;
  if (!only.includes(cat) || !item) return false;
  const p = priceAt(item, store, ctx.book, ctx.organic);
  if (p && p.source !== "estimation") return true;
  return !item.allergens.some((a) => a === "po" || a === "cr");
}

/** Magasin d'une ligne : article à part, sinon rayon à part, sinon magasin principal (si le magasin choisi ne vend pas l'article : principal). */
export function storeOf(line: PlanLine, plan: StorePlan | undefined, stores: StoreId[], ctx: PlanCtx): { store: StoreId; why: "article" | "rayon" | "principal" } {
  const main = mainStore(plan, stores);
  const item = line.itemId ? ctx.idx.get(line.itemId) : undefined;
  const ok = (st: StoreId | undefined): st is StoreId => !!st && stores.includes(st) && sells(item, line.category, st, ctx);
  const byItem = line.itemId ? plan?.items?.[line.itemId] : undefined;
  if (ok(byItem)) return { store: byItem, why: "article" };
  const byCat = plan?.cats?.[line.category];
  if (ok(byCat)) return { store: byCat, why: "rayon" };
  return { store: main, why: "principal" };
}

/** Coût d'une ligne dans un magasin (null : pas de prix, même estimé). */
export function costAt(line: PlanLine, store: StoreId, ctx: PlanCtx) {
  const item = line.itemId ? ctx.idx.get(line.itemId) : undefined;
  const p = item && priceAt(item, store, ctx.book, ctx.organic);
  return item && p ? { cost: lineCost(line.qty || item.packSize, p), estimated: p.source === "estimation" } : null;
}

export interface PlanGroup { store: StoreId; lines: PlanLine[]; total: number; known: number; estimated: number }

/** Les listes par magasin (magasin principal d'abord, puis par nombre d'articles) avec leur total. */
export function planGroups(lines: PlanLine[], plan: StorePlan | undefined, stores: StoreId[], ctx: PlanCtx): PlanGroup[] {
  const main = mainStore(plan, stores);
  const by = new Map<StoreId, PlanGroup>();
  for (const l of lines) {
    const st = storeOf(l, plan, stores, ctx).store;
    const g = by.get(st) || { store: st, lines: [], total: 0, known: 0, estimated: 0 };
    const c = costAt(l, st, ctx);
    if (c) { g.total += c.cost; if (c.estimated) g.estimated++; else g.known++; }
    g.lines.push(l);
    by.set(st, g);
  }
  return [...by.values()].sort((a, b) => Number(b.store === main) - Number(a.store === main) || b.lines.length - a.lines.length);
}

export interface Tip { line: PlanLine; from: StoreId; to: StoreId; save: number }

/**
 * Conseils : un article nettement moins cher dans un autre magasin du foyer (prix relevés des deux côtés,
 * au moins 0,50 € et 15 % d'écart), du plus rentable au moins rentable.
 */
export function planTips(lines: PlanLine[], plan: StorePlan | undefined, stores: StoreId[], ctx: PlanCtx, max = 5): Tip[] {
  const out: Tip[] = [];
  for (const l of lines) {
    const from = storeOf(l, plan, stores, ctx).store;
    const here = costAt(l, from, ctx);
    if (!here || here.estimated) continue;
    const item = l.itemId ? ctx.idx.get(l.itemId) : undefined;
    let best: Tip | null = null;
    for (const to of stores) {
      if (to === from || !sells(item, l.category, to, ctx)) continue;
      const c = costAt(l, to, ctx);
      if (!c || c.estimated) continue;
      const save = here.cost - c.cost;
      if (save >= 0.5 && save >= here.cost * 0.15 && (!best || save > best.save)) best = { line: l, from, to, save };
    }
    if (best) out.push(best);
  }
  return out.sort((a, b) => b.save - a.save).slice(0, max);
}

/** Total si tout était acheté dans un seul magasin (articles qu'il ne vend pas : au magasin principal). */
export function oneStoreTotal(lines: PlanLine[], store: StoreId, stores: StoreId[], ctx: PlanCtx) {
  return planGroups(lines, { main: store }, stores, ctx).reduce((a, g) => a + g.total, 0);
}
