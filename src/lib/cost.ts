import { ingredientsOf } from "./catalog";
import type { ItemIndex } from "./catalog";
import { bestPrice, lineCost, priceAt, type PriceBook, type PriceSel } from "./pricing";
import type { Ingredient, Recipe, StoreId, Unit } from "./types";
import type { MealPart } from "./mixed";
import { baseQty } from "./units";

export interface CostCtx { idx: ItemIndex; book: PriceBook; stores: StoreId[]; pref: StoreId | "cheapest"; organic: PriceSel | boolean }

/** Coût par personne d'un repas (part réellement utilisée de chaque article). */
export function mealCostPerPerson(r: Recipe, veg: boolean, ctx: CostCtx): number {
  return ingredientsCost(ingredientsOf(r, veg), ctx);
}

/** Coût d'une part pour une liste d'ingrédients. */
export function ingredientsCost(ings: Ingredient[], ctx: CostCtx): number {
  let sum = 0;
  for (const ing of ings) {
    const item = ctx.idx.get(ing.itemId);
    if (!item || item.staple) continue;
    const p = bestPrice(item, ctx.stores, ctx.pref, ctx.book, ctx.organic);
    if (p) sum += baseQty(ing, item) * p.pricePerUnit;
  }
  return sum;
}

export interface BuyLine { itemId: string | null; qty: number; unit: Unit | "" }

/** Total du panier dans chaque enseigne + articles qu'elle ne vend pas. */
export function storeTotals(lines: BuyLine[], stores: StoreId[], ctx: Omit<CostCtx, "stores" | "pref">) {
  const res = stores.map((s) => ({ store: s, total: 0, missing: [] as string[] }));
  for (const l of lines) {
    const item = l.itemId ? ctx.idx.get(l.itemId) : undefined;
    if (!item) continue;
    for (const r of res) {
      const p = priceAt(item, r.store, ctx.book, ctx.organic);
      if (p) r.total += lineCost(l.qty || item.packSize, p);
      else r.missing.push(item.id);
    }
  }
  return res;
}

/** Meilleure combinaison de 2 magasins : chaque article acheté là où il est le moins cher. */
export function bestPair(lines: BuyLine[], stores: StoreId[], ctx: Omit<CostCtx, "stores" | "pref">) {
  let best: { stores: [StoreId, StoreId]; total: number; split: Record<string, StoreId>; missing: number } | null = null;
  for (let i = 0; i < stores.length; i++) for (let j = i + 1; j < stores.length; j++) {
    const pair: [StoreId, StoreId] = [stores[i], stores[j]];
    let total = 0, missing = 0;
    const split: Record<string, StoreId> = {};
    for (const l of lines) {
      const item = l.itemId ? ctx.idx.get(l.itemId) : undefined;
      if (!item) continue;
      let cheapest: { s: StoreId; c: number } | null = null;
      for (const s of pair) {
        const p = priceAt(item, s, ctx.book, ctx.organic);
        if (!p) continue;
        const c = lineCost(l.qty || item.packSize, p);
        if (!cheapest || c < cheapest.c) cheapest = { s, c };
      }
      if (cheapest) { total += cheapest.c; split[item.id] = cheapest.s; } else missing++;
    }
    if (!best || missing < best.missing || (missing === best.missing && total < best.total)) best = { stores: pair, total, split, missing };
  }
  return best;
}

/** Coût total d'un plat découpé en parts (commun, viande, végé). */
export const partsCost = (parts: MealPart[], ctx: CostCtx) => parts.reduce((a, p) => a + ingredientsCost(p.ings, ctx) * p.portions, 0);
