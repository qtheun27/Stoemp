import { ingredientsOf, isVegRecipe, matchesWord, type ItemIndex } from "./catalog";
import { mealCostPerPerson, type CostCtx } from "./cost";
import { currentSeason } from "./season";
import type { GenOptions, Item, Recipe, Season, Settings, Slot, StockEntry } from "./types";

export interface PlanCtx {
  idx: ItemIndex;
  settings: Settings;
  favorites: string[];
  stock: Map<string, StockEntry>;
  cost: CostCtx;
  now?: Date;
  rand?: () => number;
}

export const planSeason = (o: GenOptions, now = new Date()): Season => (o.season === "auto" ? currentSeason(now) : o.season);

/** Part d'ingrédients principaux (légumes, viande, frais) produits en Belgique. */
export function localShare(r: Recipe, veg: boolean, idx: ItemIndex) {
  const main = ingredientsOf(r, veg).map((i) => idx.get(i.itemId)).filter((i): i is Item => !!i && ["fl", "vi", "fr"].includes(i.category));
  return main.length ? main.filter((i) => i.local).length / main.length : 1;
}

export function allergensOf(r: Recipe, veg: boolean, idx: ItemIndex) {
  const s = new Set<string>();
  for (const ing of ingredientsOf(r, veg)) idx.get(ing.itemId)?.allergens.forEach((a) => s.add(a));
  return [...s];
}

/** Le repas respecte-t-il les options cochées ? (Le budget est géré globalement.) */
export function allowed(r: Recipe, o: GenOptions, idx: ItemIndex, now = new Date()): boolean {
  if (r.deleted) return false;
  const veg = o.veg;
  if (veg && !isVegRecipe(r) && !r.vegSwap.length) return false;
  if (o.seasonal && !r.seasons.includes(planSeason(o, now))) return false;
  if (o.timeOn && r.prepMin > o.maxTime) return false;
  if (o.allergens.length) {
    const al = allergensOf(r, veg, idx);
    if (o.allergens.some((a) => al.includes(a))) return false;
  }
  if (o.avoid.length) {
    const names = [r.name, ...ingredientsOf(r, veg).map((i) => idx.get(i.itemId)?.name || "")];
    if (o.avoid.some((w) => names.some((n) => matchesWord(n, w)))) return false;
  }
  if (o.local && localShare(r, veg, idx) < 0.5) return false;
  return true;
}

/** Jours avant péremption d'une fiche de stock (Infinity si inconnu). */
export function daysToExpiry(s: StockEntry | undefined, now = new Date()) {
  if (!s?.expiresAt) return Infinity;
  return (new Date(s.expiresAt).getTime() - now.getTime()) / 86400000;
}

/** Score de préférence : favoris, stock à écouler (surtout ce qui périme), produits locaux. */
export function score(r: Recipe, ctx: PlanCtx): number {
  const o = ctx.settings.options;
  let s = 1;
  if (o.favorites && (ctx.favorites.includes(r.id) || r.source === "perso")) s *= 3;
  if (o.useStock) {
    for (const ing of ingredientsOf(r, o.veg)) {
      const st = ctx.stock.get(ing.itemId);
      const item = ctx.idx.get(ing.itemId);
      if (!st || st.qty <= 0 || item?.staple) continue;
      const d = daysToExpiry(st, ctx.now);
      s += d <= 3 ? 4 : d <= 7 ? 2 : 0.7;
    }
  }
  if (o.local) s *= 0.5 + localShare(r, o.veg, ctx.idx);
  return s;
}

function weightedPick<T>(items: T[], weights: number[], rand: () => number): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rand() * total;
  for (let i = 0; i < items.length; i++) { x -= weights[i]; if (x <= 0) return items[i]; }
  return items[items.length - 1];
}

export interface PlanResult { slots: Slot[]; warning?: string; costPerPersonWeek: number }

/**
 * Génère les créneaux de la semaine : plats perso placés d'abord, puis tirage pondéré sans répétition,
 * puis ajustement au budget en remplaçant les repas les plus chers.
 */
export function planWeek(pool: Recipe[], ctx: PlanCtx, fresh: Recipe[] = []): PlanResult {
  const { settings } = ctx;
  const o = settings.options;
  const rand = ctx.rand || Math.random;
  const meals: Slot["meal"][] = settings.mealsPerDay === 2 ? ["midi", "soir"] : ["soir"];
  const N = 7 * meals.length;
  const ok = pool.filter((r) => allowed(r, o, ctx.idx, ctx.now));
  if (!ok.length && !fresh.length) return { slots: [], warning: "Aucun repas ne correspond à tes options. Décoche-en une ou deux.", costPerPersonWeek: 0 };

  const mine = ok.filter((r) => r.source === "perso").sort(() => rand() - 0.5).slice(0, Math.min(settings.mineN, N));
  const chosen: Recipe[] = [...mine, ...fresh.slice(0, N - mine.length)];
  const used = new Set(chosen.map((r) => r.id));
  while (chosen.length < N) {
    let cands = ok.filter((r) => !used.has(r.id) && r.source !== "perso");
    if (!cands.length) cands = ok.filter((r) => r.source !== "perso");
    if (!cands.length) cands = ok;
    const r = weightedPick(cands, cands.map((c) => score(c, ctx)), rand);
    chosen.push(r);
    used.add(r.id);
  }

  const cost = (r: Recipe) => mealCostPerPerson(r, o.veg, ctx.cost);
  let warning: string | undefined;
  if (o.budgetOn && o.budget > 0) {
    const limitPP = o.budget / settings.persons;
    const cheap = ok.filter((r) => r.source !== "perso").sort((a, b) => cost(a) - cost(b));
    for (let guard = 0; guard < N * 2; guard++) {
      const total = chosen.reduce((s, r) => s + cost(r), 0);
      if (total <= limitPP) break;
      let iMax = -1, cMax = -1;
      chosen.forEach((r, i) => { if (r.source !== "perso" && cost(r) > cMax) { cMax = cost(r); iMax = i; } });
      const repl = cheap.find((r) => cost(r) < cMax && !chosen.includes(r)) || cheap.find((r) => cost(r) < cMax);
      if (iMax < 0 || !repl) { warning = "Budget trop serré : semaine la moins chère possible proposée."; break; }
      chosen[iMax] = repl;
    }
  }

  // Mélange pour répartir plats perso et nouveautés dans la semaine.
  const order = chosen.map((r, i) => ({ r, k: rand() + i * 0 })).sort((a, b) => a.k - b.k).map((x) => x.r);
  const slots: Slot[] = [];
  let k = 0;
  for (let day = 0; day < 7; day++) for (const meal of meals) {
    const r = order[k++];
    slots.push({ day, meal, recipeId: r.id, veg: o.veg && !isVegRecipe(r), cooked: false });
  }
  return { slots, warning, costPerPersonWeek: order.reduce((s, r) => s + cost(r), 0) };
}

/** Un seul repas de remplacement, différent de ceux de la semaine. */
export function pickOne(pool: Recipe[], ctx: PlanCtx, exclude: Set<string>): Recipe | null {
  const ok = pool.filter((r) => allowed(r, ctx.settings.options, ctx.idx, ctx.now) && r.source !== "perso");
  const c = ok.filter((r) => !exclude.has(r.id));
  const list = c.length ? c : ok;
  if (!list.length) return null;
  return weightedPick(list, list.map((r) => score(r, ctx)), ctx.rand || Math.random);
}

/** Recettes qui utilisent un article (pour écouler ce qui périme). */
export const recipesUsing = (pool: Recipe[], itemId: string) =>
  pool.filter((r) => !r.deleted && [...r.ingredients, ...r.meat, ...r.vegSwap].some((i) => i.itemId === itemId));
