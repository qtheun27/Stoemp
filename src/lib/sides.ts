import type { ItemIndex } from "./catalog";
import { norm } from "./text";
import type { Recipe, Slot } from "./types";

/**
 * Accompagnement au choix : une carbonnade se mange avec des frites, une purée, des pommes vapeur…
 * Le féculent « d'accompagnement » du plat est retiré et remplacé par une recette d'accompagnement ;
 * courses, coût, stock et étapes suivent.
 */
export type SideFamily = "pdt" | "riz" | "grain" | "pain";
const FAMILY: [SideFamily, RegExp][] = [
  ["pdt", /pommes? de terre|grenaille|frites|croquettes|patate douce|puree/],
  ["riz", /^riz( basmati| rond)?$|^riz$/],
  ["grain", /semoule|boulgour|quinoa|polenta|frik|epeautre/],
  // Pains servis à côté (pas le pain d'épices d'une carbonnade, ni le pain de mie d'un croque).
  ["pain", /^pain( de campagne| gris| pita)?$|^baguette|^pistolets?$|^naan|^chapati/],
];
/** Plats dont le féculent EST le plat (moules-frites, fish and chips, pâtes, risotto…) : on ne le remplace pas.
 *  Les autres ne nomment pas leur accompagnement : il s'affiche à côté du nom et se choisit dans la semaine. */
const CORE = /frites|puree|pommes vapeur|pommes de terre|grenailles|semoule|polenta|pates|spaghetti|lasagne|cannelloni|tagliatelle|gnocchi|risotto|paella|paëlla|riz |nasi|biryani|pulao|pilaf|kabsa|jambalaya|arroz|fideu|couscous|hachis|parmentier|stoemp|gratin (savoyard|de pates|de macaroni)|tartiflette|raclette|fondue|tortilla|tacos|wrap|burrito|quesadilla|fajitas|enchilada|sandwich|burger|croque|pizza|calzone|quiche|tarte|tourte|pie|wellington|pastilla|empanada|galette|crepe|pide|bowl|salade|soupe|ramen|nouilles|pad |udon|okonomiyaki|bao|banh|pita|kedgeree|risi|congee|frittata|omelette|choucroute|pot-au-feu|potee|hochepot|cocido|garbure|irish stew|pot roast|poule au pot|patatas|papas|aloo|pav bhaji|dum |batata|huevos|chilaquiles|gado/;

const familyOf = (name: string): SideFamily | null => FAMILY.find(([, re]) => re.test(norm(name)))?.[0] ?? null;

/** Ingrédients « accompagnement » du plat (remplaçables) et leur famille ; aucun si le féculent est le plat. */
export function swappableStarch(r: Recipe, idx: ItemIndex): { ids: Set<string>; family: SideFamily } | null {
  if ((r.course || "plat") !== "plat" || r.source === "pret" || CORE.test(norm(r.name))) return null;
  const ids = new Set<string>();
  let family: SideFamily | null = null;
  for (const i of r.ingredients) {
    const f = familyOf(idx.get(i.itemId)?.name || "");
    if (f) { ids.add(i.itemId); family ??= f; }
  }
  return family ? { ids, family } : null;
}

/** Famille d'un accompagnement (recette « accompagnement » qui contient un féculent). */
export function sideFamily(side: Recipe, idx: ItemIndex): SideFamily | null {
  if (side.course !== "accompagnement" || side.deleted) return null;
  for (const i of side.ingredients) { const f = familyOf(idx.get(i.itemId)?.name || ""); if (f) return f; }
  return null;
}

/** Accompagnements possibles pour ce plat : même famille (pommes de terre ↔ pommes de terre…), même cuisine d'abord. */
export function sideOptions(r: Recipe, all: Iterable<Recipe>, idx: ItemIndex): Recipe[] {
  const s = swappableStarch(r, idx);
  if (!s) return [];
  const ok = (f: SideFamily | null) => f === s.family || (s.family === "riz" && f === "pain" && r.cuisine === "indienne") || (s.family === "grain" && f === "riz");
  return [...all].filter((x) => ok(sideFamily(x, idx)))
    .sort((a, b) => Number(b.cuisine === r.cuisine) - Number(a.cuisine === r.cuisine) || a.prepMin - b.prepMin);
}

/** Recette du repas avec l'accompagnement choisi : féculent d'origine remplacé, étapes de l'accompagnement à la suite. */
export function withSide(r: Recipe, side: Recipe | null | undefined, idx: ItemIndex): Recipe {
  if (!side) return r;
  const s = swappableStarch(r, idx);
  if (!s) return r;
  const steps = side.steps.length ? [`Accompagnement — ${side.name} :`, ...side.steps] : [`Accompagnement : ${side.name}.`];
  return {
    ...r,
    ingredients: [...r.ingredients.filter((i) => !s.ids.has(i.itemId)), ...side.ingredients],
    steps: [...r.steps, ...steps],
    prepMin: Math.max(r.prepMin, side.prepMin),
    sideName: side.name,
  };
}

/** Recette effective d'un créneau de la semaine (plat + accompagnement choisi). */
export function slotRecipe(recipes: Map<string, Recipe>, slot: Pick<Slot, "recipeId" | "side">, idx: ItemIndex): Recipe | undefined {
  const r = recipes.get(slot.recipeId);
  return r && slot.side ? withSide(r, recipes.get(slot.side), idx) : r;
}

/** Nom de l'accompagnement d'origine du plat (« pommes de terre », « riz »…), pour l'afficher quand rien n'est choisi. */
export function defaultSideLabel(r: Recipe, idx: ItemIndex): string | null {
  const s = swappableStarch(r, idx);
  if (!s) return null;
  if (r.sideLabel) return r.sideLabel;
  const names = [...s.ids].map((id) => idx.get(id)?.name.toLowerCase()).filter(Boolean);
  return names.length ? names.join(" et ") : null;
}

/**
 * Accompagnements proposés d'office pour la semaine : un par plat où il est interchangeable,
 * varié (pas deux fois le même), même cuisine d'abord ; le plat garde sinon celui de sa recette.
 */
export function assignSides<T extends Pick<Slot, "recipeId" | "side" | "fromLeftovers">>(slots: T[], recipes: Map<string, Recipe>, idx: ItemIndex, rand = Math.random): T[] {
  const used = new Set<string>();
  const all = [...recipes.values()];
  return slots.map((sl) => {
    const r = recipes.get(sl.recipeId);
    if (!r || sl.fromLeftovers || sl.side !== undefined) return sl;
    const opts = sideOptions(r, all, idx).filter((x) => !used.has(x.id));
    const same = opts.filter((x) => x.cuisine === r.cuisine);
    const pool = (same.length ? same : opts).slice(0, 5);
    if (!pool.length) return sl;
    const pick = pool[Math.floor(rand() * pool.length)];
    used.add(pick.id);
    return { ...sl, side: pick.id };
  });
}
