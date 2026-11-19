import { ingredientsOf, isVegRecipe, matchesWord, type ItemIndex } from "./catalog";
import { allAllergens, groupScore, type Tastes } from "./tastes";
import { mealCostPerPerson, type CostCtx } from "./cost";
import { currentSeason } from "./season";
import type { GenOptions, Item, Recipe, Season, Settings, Slot, StockEntry } from "./types";
import { profile, type Protein } from "./balance";
import { eatersOf, portionsOf } from "./household";
import { priceKey } from "./pricing";

export interface PlanCtx {
  idx: ItemIndex;
  settings: Settings;
  favorites: string[];
  stock: Map<string, StockEntry>;
  cost: CostCtx;
  now?: Date;
  rand?: () => number;
  /** Goûts des membres du foyer (profils et avis) : le planificateur choisit des plats qui plaisent à toute la table. */
  tastes?: Tastes;
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
  if (o.kidFriendly && kidUnfriendly(r, veg)) return false;
  return true;
}

/** Plats peu appréciés des enfants : épicés ou très relevés. */
const SPICY = ["epices-chili", "curry", "epices-fajitas", "piment", "harissa", "wasabi"];
export const kidUnfriendly = (r: Recipe, veg: boolean) => ingredientsOf(r, veg).some((i) => SPICY.some((k) => i.itemId.includes(k)));

/** Options réellement appliquées : « plats pour enfants » seulement s'il y a des enfants. */
export function effectiveOptions(s: Settings): GenOptions {
  const e = eatersOf(s);
  return { ...s.options, kidFriendly: !!s.options.kidFriendly && e.kids > 0 };
}

/** Article en promo dans un des magasins du foyer (prix relevé il y a moins de 10 jours). */
export function onPromo(itemId: string, ctx: PlanCtx): boolean {
  const recent = new Date(Date.now() - 10 * 86400000).toISOString();
  return ctx.cost.stores.some((st) => {
    const p = ctx.cost.book.shared.get(priceKey(itemId, st));
    return !!p && !!p.promo && p.fetchedAt >= recent && (!!p.offers?.length ? p.offers.some((o) => o.promo) : true);
  });
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
  // Goûts de chacun : un plat qui plaît à tous monte, un plat refusé par un membre disparaît presque.
  if (ctx.tastes?.people.length) s *= groupScore(r, ctx.tastes, ctx.idx);
  // Cuisines préférées : plus souvent, sans exclure les autres (variété).
  if (o.cuisines?.length) s *= r.cuisine && o.cuisines.includes(r.cuisine) ? 2.5 : 0.5;
  // Promos de la semaine dans les magasins du foyer.
  if (o.promos !== false) {
    const promo = ingredientsOf(r, o.veg).filter((i) => !ctx.idx.get(i.itemId)?.staple && onPromo(i.itemId, ctx)).length;
    s *= 1 + 0.35 * Math.min(3, promo);
  }
  return s;
}

function weightedPick<T>(items: T[], weights: number[], rand: () => number): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rand() * total;
  for (let i = 0; i < items.length; i++) { x -= weights[i]; if (x <= 0) return items[i]; }
  return items[items.length - 1];
}

type MealSettings = Pick<Settings, "lunches" | "dinners" | "mealsPerDay" | "lunchDays" | "dinnerDays"> & Partial<Pick<Settings, "breakfastDays">>;
const cleanDays = (d: number[]) => [...new Set(d.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))].sort((a, b) => a - b);
/** Jours de la semaine (0 = lundi) où l'on cuisine le midi et le soir : jours choisis, sinon répartis selon le nombre. */
export function mealDays(s: MealSettings) {
  const lunchN = Math.min(7, Math.max(0, s.lunches ?? (s.mealsPerDay === 2 ? 7 : 0)));
  const dinnerN = Math.min(7, Math.max(0, s.dinners ?? 7));
  return {
    lunch: Array.isArray(s.lunchDays) ? cleanDays(s.lunchDays) : spreadDays(lunchN),
    dinner: Array.isArray(s.dinnerDays) ? cleanDays(s.dinnerDays) : spreadDays(dinnerN),
    breakfast: cleanDays(s.breakfastDays || []),
  };
}

/** Repas léger possible : soupe, ou plat de type salade-repas, tartine, omelette, quiche, bowl… */
const LIGHT_RE = /salade|soupe|velout|potage|tartine|croque-|omelette|frittata|tortilla espagnole|quiche|tarte fine|flamiche|wrap|bowl|poke|toast|bruschetta|gaspacho|gazpacho|tabboul|taboul|fattouche|bo bun|galette|quesadilla|bagel|sandwich|club|pan bagnat|shakshuka|chakchouka|huevos/i;
// La salade servie à côté (« Mac and cheese et salade ») ne fait pas un repas léger : seul le plat compte.
const SIDE_SALAD = /\s*(,| et| avec)\s+(une\s+)?(petite\s+)?salade\b.*$/i;
const HEAVY_RE = /mac and cheese|lasagne|gratin|tartiflette|raclette|fondue|cassoulet|choucroute|moussaka|parmigiana|frites/i;
export const isLightMeal = (r: Recipe) => {
  if (r.source === "pret") return false;
  const course = r.course || "plat", dish = r.name.replace(SIDE_SALAD, "");
  return course === "soupe" || (course === "plat" && LIGHT_RE.test(dish) && !HEAVY_RE.test(dish));
};
export const isBreakfast = (r: Recipe) => r.source !== "pret" && r.course === "petitdej";
/** Recettes possibles pour un créneau : déjeuner du matin, repas léger ou repas complet. */
export const poolFor = (sl: Pick<Slot, "meal" | "light">, all: Recipe[]) =>
  sl.meal === "matin" ? all.filter(isBreakfast) : sl.light ? all.filter(isLightMeal) : all.filter((r) => r.source !== "pret" && (r.course || "plat") === "plat");
/** Créneaux de la semaine (jour, repas, léger), dans l'ordre. */
export function weekFrame(s: MealSettings & Partial<Pick<Settings, "lightSlots">>) {
  const d = mealDays(s), light = new Set(s.lightSlots || []), out: { day: number; meal: Slot["meal"]; light: boolean }[] = [];
  for (let day = 0; day < 7; day++) {
    if (d.breakfast.includes(day)) out.push({ day, meal: "matin", light: false });
    if (d.lunch.includes(day)) out.push({ day, meal: "midi", light: light.has(`${day}-midi`) });
    if (d.dinner.includes(day)) out.push({ day, meal: "soir", light: light.has(`${day}-soir`) });
  }
  return out;
}
/** Repas par semaine (compatible avec l'ancien réglage 7 / 14 repas). */
export function mealCounts(s: MealSettings) {
  const d = mealDays(s);
  return { lunches: d.lunch.length, dinners: d.dinner.length, total: d.lunch.length + d.dinner.length };
}
/** Répartit n repas sur la semaine (0 = lundi) : 7 → tous les jours, 2 → mardi et samedi, 1 → jeudi. */
export const spreadDays = (n: number) => Array.from({ length: n }, (_, i) => Math.floor(((i + 0.5) * 7) / n));

export interface PlanResult { slots: Slot[]; warning?: string; costPerPersonWeek: number }

/**
 * Génère les créneaux de la semaine : plats perso placés d'abord, puis tirage pondéré sans répétition,
 * puis ajustement au budget en remplaçant les repas les plus chers.
 */
export function planWeek(pool: Recipe[], ctx: PlanCtx, fresh: Recipe[] = [], all: Recipe[] = pool): PlanResult {
  const { settings } = ctx;
  const o = settings.options;
  const rand = ctx.rand || Math.random;
  const frame = weekFrame(settings);
  const full = frame.filter((f) => f.meal !== "matin" && !f.light);
  const N = full.length;
  const eo = effectiveOptions(settings);
  // Les allergies de chaque membre valent pour tout le repas.
  if (ctx.tastes?.people.length) eo.allergens = [...new Set([...eo.allergens, ...allAllergens(ctx.tastes.people)])];
  const ok = pool.filter((r) => allowed(r, eo, ctx.idx, ctx.now));
  if (N && !ok.length && !fresh.length) return { slots: [], warning: "Aucun repas ne correspond à tes options. Décoche-en une ou deux.", costPerPersonWeek: 0 };

  const mine = ok.filter((r) => r.source === "perso").sort(() => rand() - 0.5).slice(0, Math.min(settings.mineN, N));
  const chosen: Recipe[] = [...mine, ...fresh.slice(0, N - mine.length)];
  const used = new Set(chosen.map((r) => r.id));
  while (chosen.length < N) {
    let cands = ok.filter((r) => !used.has(r.id) && r.source !== "perso");
    if (!cands.length) cands = ok.filter((r) => r.source !== "perso");
    if (!cands.length) cands = ok;
    const weights = cands.map((c) => score(c, ctx) * (o.balance !== false ? balanceFactor(c, chosen, N, ctx) : 1));
    const r = weightedPick(cands, weights, rand);
    chosen.push(r);
    used.add(r.id);
  }

  const cost = (r: Recipe) => mealCostPerPerson(r, o.veg, ctx.cost);
  let warning: string | undefined;
  if (o.budgetOn && o.budget > 0) {
    const limitPP = o.budget / Math.max(0.5, portionsOf(eatersOf(settings)));
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

  // Mélange pour répartir plats perso et nouveautés, puis on évite deux fois le même féculent d'affilée.
  let order = chosen.map((r) => ({ r, k: rand() })).sort((a, b) => a.k - b.k).map((x) => x.r);
  if (o.balance !== false) order = spreadStarches(order, o.veg, ctx);
  // Repas légers et déjeuners du matin : tirés de leur propre liste, sans répétition dans la semaine.
  const allOk = all.filter((r) => allowed(r, eo, ctx.idx, ctx.now));
  const taken = new Set(order.map((r) => r.id));
  const pickFor = (f: { meal: Slot["meal"]; light: boolean }) => {
    const cands = poolFor(f, allOk);
    const fresh = cands.filter((r) => !taken.has(r.id));
    const list = fresh.length ? fresh : cands;
    if (!list.length) return null;
    const r = weightedPick(list, list.map((c) => score(c, ctx)), rand);
    taken.add(r.id);
    return r;
  };
  const slots: Slot[] = [];
  let k = 0;
  for (const f of frame) {
    const r = f.meal !== "matin" && !f.light ? order[k++] : pickFor(f);
    if (!r) continue;
    slots.push({ day: f.day, meal: f.meal, ...(f.light ? { light: true } : {}), recipeId: r.id, veg: o.veg && !isVegRecipe(r), cooked: false });
  }
  if (!slots.length) return { slots, warning: "Aucun repas ne correspond à tes options. Décoche-en une ou deux.", costPerPersonWeek: 0 };
  return { slots, warning, costPerPersonWeek: order.reduce((s, r) => s + cost(r), 0) };
}

/** Pondération d'équilibre : favorise le poisson et les légumineuses tant qu'il en manque, freine l'excès de viande. */
function balanceFactor(r: Recipe, chosen: Recipe[], N: number, ctx: PlanCtx): number {
  const veg = ctx.settings.options.veg;
  const count = (p: Protein) => chosen.filter((c) => profile(c, veg, ctx.idx).protein === p).length;
  const p = profile(r, veg, ctx.idx).protein;
  const noFish = ctx.settings.options.allergens.includes("po") || veg;
  if (p === "poisson" && !noFish && count("poisson") < Math.max(1, Math.round(N / 7))) return 2.5;
  if (p === "legumineuses" && count("legumineuses") < 1) return 1.8;
  if (p === "viande" && count("viande") >= Math.ceil(N * 0.6)) return 0.4;
  return 1;
}

/** Réordonne pour éviter le même féculent deux repas de suite. */
function spreadStarches(list: Recipe[], veg: boolean, ctx: PlanCtx): Recipe[] {
  const out: Recipe[] = [];
  const rest = [...list];
  while (rest.length) {
    const prev = out.length ? profile(out[out.length - 1], veg, ctx.idx).starch : null;
    const i = rest.findIndex((r) => { const st = profile(r, veg, ctx.idx).starch; return st === "autre" || st !== prev; });
    out.push(...rest.splice(i >= 0 ? i : 0, 1));
  }
  return out;
}

/** Un seul repas de remplacement, différent de ceux de la semaine (pool : poolFor(créneau, recettes)). */
export function pickOne(pool: Recipe[], ctx: PlanCtx, exclude: Set<string>): Recipe | null {
  const eo = effectiveOptions(ctx.settings);
  if (ctx.tastes?.people.length) eo.allergens = [...new Set([...eo.allergens, ...allAllergens(ctx.tastes.people)])];
  const ok = pool.filter((r) => allowed(r, eo, ctx.idx, ctx.now) && r.source !== "perso");
  const c = ok.filter((r) => !exclude.has(r.id));
  const list = c.length ? c : ok;
  if (!list.length) return null;
  return weightedPick(list, list.map((r) => score(r, ctx)), ctx.rand || Math.random);
}

/** Recettes qui utilisent un article (pour écouler ce qui périme). */
export const recipesUsing = (pool: Recipe[], itemId: string) =>
  pool.filter((r) => !r.deleted && [...r.ingredients, ...r.meat, ...r.vegSwap].some((i) => i.itemId === itemId));
