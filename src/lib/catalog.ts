import { CATALOG_RAW } from "../data/catalog-raw";
import { RECIPES_RAW, type RawRecipe } from "../data/recipes-raw";
import { CUISINE_OF, LIGHT_MEALS, RECIPES_MORE, type Cuisine } from "../data/recipes-more";
import type { Allergen, Cat, Course, Ingredient, Item, Recipe, Season, Unit } from "./types";
import { keyOf, norm, slug } from "./text";

function months(s: string): number[] {
  if (!s) return [];
  const out = new Set<number>();
  for (const part of s.split(",")) {
    const [a, b] = part.split("-").map(Number);
    if (!b) { out.add(a); continue; }
    for (let m = a; ; m = (m % 12) + 1) { out.add(m); if (m === b) break; }
  }
  return [...out].sort((x, y) => x - y);
}

export function parseCatalog(raw = CATALOG_RAW): Item[] {
  return raw.trim().split("\n").filter((l) => l.includes("|")).map((line) => {
    const [name, cat, unit, pack, price, flags, shelf, alg, aliases, mon] = line.split("|");
    return {
      id: slug(name),
      name,
      aliases: aliases ? aliases.split(",").map((a) => a.trim()).filter(Boolean) : [],
      category: cat as Cat,
      unit: unit as Unit,
      packSize: Number(pack),
      demoPrice: Number(price),
      local: flags.includes("L"),
      organicAvailable: flags.includes("B"),
      perishable: flags.includes("P"),
      staple: flags.includes("S"),
      common: flags.includes("C"),
      shelfLifeDays: Number(shelf) || (flags.includes("P") ? 7 : 365),
      allergens: (alg ? alg.split(",") : []) as Allergen[],
      seasonMonths: months(mon || ""),
      source: "base" as const,
    };
  });
}

/** Index de recherche nom/alias → article. */
export class ItemIndex {
  byId = new Map<string, Item>();
  byKey = new Map<string, Item>();
  constructor(items: Item[]) { items.forEach((i) => this.add(i)); }
  add(i: Item) {
    this.byId.set(i.id, i);
    for (const n of [i.name, ...i.aliases]) { const k = keyOf(n); if (!this.byKey.has(k)) this.byKey.set(k, i); }
  }
  get(id: string) { return this.byId.get(id); }
  /** Correspondance exacte (nom ou alias, pluriels tolérés), puis inclusion d'un nom connu. */
  find(text: string): Item | undefined {
    const k = keyOf(text);
    const exact = this.byKey.get(k);
    if (exact) return exact;
    let best: Item | undefined, bestLen = 0;
    for (const [key, item] of this.byKey) {
      if (key.length >= 4 && key.length > bestLen && (` ${k} `).includes(` ${key} `)) { best = item; bestLen = key.length; }
    }
    return best;
  }
  all() { return [...this.byId.values()]; }
  /**
   * Articles proches d'un nom libre (ticket de caisse…) : mots en commun, un mot pouvant être le début de l'autre
   * (« vege » ↔ « végétale », « tige » ↔ « tiges »), les plus de mots communs d'abord.
   */
  suggest(text: string, max = 5): Item[] {
    const words = (s: string) => keyOf(s).split(/[\s-]+/).filter((w) => w.length >= 3);
    const want = words(text);
    if (!want.length) return [];
    const near = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));
    const scored: [Item, number][] = [];
    for (const i of this.byId.values()) {
      const have = [i.name, ...i.aliases].flatMap(words);
      const n = want.filter((w) => have.some((h) => near(w, h))).length;
      if (n) scored.push([i, n]);
    }
    return scored.sort((a, b) => b[1] - a[1] || a[0].name.length - b[0].name.length).slice(0, max).map(([i]) => i);
  }
}

const SEASON_CODES: Season[] = ["P", "E", "A", "H"];

function parseIng(s: string, idx: ItemIndex): Ingredient {
  const [name, q] = s.split(":");
  const item = idx.find(name);
  if (!item) throw new Error(`Article inconnu dans une recette : ${name}`);
  const m = q.match(/^([\d.]+)([a-z]*)$/)!;
  const qty = Number(m[1]);
  const u = m[2];
  if (u === "cs" || u === "cc") return { itemId: item.id, qtyPerPerson: qty, spoon: u };
  return { itemId: item.id, qtyPerPerson: qty };
}

export function parseBaseRecipes(idx: ItemIndex): Recipe[] {
  const all: [RawRecipe, Cuisine | undefined][] = [...RECIPES_RAW.map((r) => [r, CUISINE_OF[r[0]]] as [RawRecipe, Cuisine | undefined]),
    ...RECIPES_MORE.map((r) => [r.slice(0, 8) as RawRecipe, r[8]] as [RawRecipe, Cuisine])];
  return all.map(([[name, s, t, ing, meat, veg, vegName, steps], cuisine]) => ({
    id: "base-" + slug(name),
    name,
    vegName: meat.length ? vegName : null,
    seasons: s === "T" ? SEASON_CODES : (s.split("") as Season[]),
    prepMin: t,
    ingredients: ing.map((x) => parseIng(x, idx)),
    meat: meat.map((x) => parseIng(x, idx)),
    vegSwap: veg.map((x) => parseIng(x, idx)),
    steps: steps.split("|"),
    source: "base" as const,
    cuisine,
    ...(LIGHT_MEALS.has(name) ? { light: true } : {}),
  }));
}

export const BASE_ITEMS = parseCatalog();
export const BASE_INDEX = new ItemIndex(BASE_ITEMS);
export const BASE_RECIPES = parseBaseRecipes(BASE_INDEX);

export const isVegRecipe = (r: Recipe) => r.meat.length === 0;
/** Recettes à cuisiner (sans les plats préparés du magasin). */
export const cookable = (recipes: Iterable<Recipe>) => [...recipes].filter((r) => r.source !== "pret");
/** Plats principaux à cuisiner : ce que le planificateur peut placer dans la semaine. */
export const mains = (recipes: Iterable<Recipe>) => cookable(recipes).filter((r) => (r.course || "plat") === "plat");

/** Fiche compacte de la bibliothèque (document « library ») → recette sans étapes. */
/** Ingrédient d'une fiche : [article, quantité par personne] ou [article, cuillères par personne, "cs" | "cc"]. */
type LibIng = [string, number] | [string, number, "cs" | "cc"];
export interface LibEntry { i: string; n: string; v: string | null; t: number; s: string; c: Cuisine; k?: Course; lt?: 1; sd?: string; vs?: string[]; pr?: string[]; nt?: 1; g: LibIng[]; m: LibIng[]; w: LibIng[] }
export function libRecipe(e: LibEntry): Recipe {
  const ing = (l: LibIng[]) => (l || []).map(([itemId, qtyPerPerson, spoon]) => ({ itemId, qtyPerPerson, ...(spoon ? { spoon } : {}) }));
  return { id: e.i, name: e.n, vegName: e.v, prepMin: e.t, seasons: (e.s || "PEAH").split("") as Season[], ingredients: ing(e.g), meat: ing(e.m), vegSwap: ing(e.w),
    steps: [], source: "base", cuisine: e.c, course: e.k || "plat", lib: true, ...(e.lt ? { light: true } : {}), ...(e.sd ? { sideLabel: e.sd } : {}), ...(e.vs ? { vegSide: e.vs } : {}), ...(e.pr ? { pairs: e.pr } : {}), ...(e.nt ? { neutral: true } : {}) };
}
export const ingredientsOf = (r: Recipe, veg: boolean): Ingredient[] =>
  r.ingredients.concat(isVegRecipe(r) ? [] : veg ? r.vegSwap : r.meat);
export const nameOf = (r: Recipe, veg: boolean) => (veg && !isVegRecipe(r) && r.vegName ? r.vegName : r.name);
export const matchesWord = (text: string, word: string) => norm(text).includes(norm(word));
