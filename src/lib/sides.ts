import type { ItemIndex } from "./catalog";
import { profile } from "./balance";
import { currentSeason } from "./season";
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
const CORE = /frites|puree|pommes vapeur|pommes de terre|grenailles|semoule|polenta|pates|spaghetti|lasagne|cannelloni|tagliatelle|gnocchi|risotto|paella|paëlla|riz |nasi|biryani|pulao|pilaf|kabsa|jambalaya|arroz|fideu|couscous|hachis|parmentier|stoemp|gratin (savoyard|de pates|de macaroni)|tartiflette|raclette|fondue|tortilla|tacos|wrap|burrito|quesadilla|fajitas|enchilada|sandwich|burger|croque|pizza|calzone|quiche|tarte|tourte|pie|wellington|pastilla|empanada|galette|crepe|pide|bowl|salade|soupe|ramen|nouilles|pad |udon|okonomiyaki|bao|banh|pita|kedgeree|risi|congee|frittata|omelette|choucroute|pot-au-feu|potee|hochepot|cocido|garbure|irish stew|pot roast|poule au pot|patatas|papas|aloo|pav bhaji|dum |batata|huevos|chilaquiles|gado|fish and chips|chowder|grits|brandade|bacalhau|bouillabaisse|marmitako|caldo verde|minestrone|velout|waterzooi|navarin|curry japonais|massaman|malai kofta|vispannetje|escondidinho|tajine de poisson|tajine de legumes|psari plaki|fasolakia|lentejas|patate|spezzatino|pommes de terre grecques|aji de gallina|tomates farcies|gemista|taboul|koshari|bibimbap|khao man gai|boulgour aux|rfissa|mercimek|fattouche|musakhan|choripan|philly|hot-dog|tartine|saltado|arancini|sushi|maki|onigiri|oyakodon|gyudon|katsudon|donburi|chirashi|poke|kedgeree|riz cantonais|riz saute|nasi goreng/;

const familyOf = (name: string): SideFamily | null => FAMILY.find(([, re]) => re.test(norm(name)))?.[0] ?? null;

/** Ingrédients « accompagnement » du plat (remplaçables) et leur famille ; aucun si le féculent est le plat. */
export function swappableStarch(r: Recipe, idx: ItemIndex): { ids: Set<string>; family: SideFamily } | null {
  if ((r.course || "plat") !== "plat" || r.source === "pret" || CORE.test(norm(r.name))) return null;
  // Féculents du plat, par famille. La patate douce n'est l'accompagnement que si la recette le dit.
  const label = norm(r.sideLabel || "");
  const byFam = new Map<SideFamily, string[]>();
  for (const i of r.ingredients) {
    const n = norm(idx.get(i.itemId)?.name || "");
    if (/patate douce/.test(n) && !/patate/.test(label)) continue;
    const f = familyOf(n);
    if (f) byFam.set(f, [...(byFam.get(f) || []), i.itemId]);
  }
  if (!byFam.size) return null;
  // L'accompagnement d'origine décide ; sinon le riz servi à côté d'un plat qui contient des pommes de terre,
  // et le pain seulement s'il est le seul féculent.
  const fromLabel = label ? familyOf(label) : null;
  const order: SideFamily[] = ["riz", "grain", "pdt", "pain"];
  const family = fromLabel && byFam.has(fromLabel) ? fromLabel : order.find((f) => byFam.has(f))!;
  return { ids: new Set(byFam.get(family)), family };
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
  // Comme un chef : un accompagnement de la même famille de cuisine, ou un classique « neutre » (purée, frites, riz pilaf…) pour la cuisine européenne.
  const g = GROUP[r.cuisine || "belge"];
  const fits = (x: Recipe) => GROUP[x.cuisine || "belge"] === g || (!!x.neutral && EURO.has(g));
  return [...all].filter((x) => !x.deleted && ok(sideFamily(x, idx)) && fits(x))
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
    meat: [...r.meat, ...side.meat], vegSwap: [...r.vegSwap, ...side.vegSwap],
    steps: [...adaptSteps(r, s.ids, side, idx), ...steps],
    prepMin: Math.max(r.prepMin, side.prepMin),
    sideName: side.name,
  };
}

// Féculent d'origine cité dans les étapes (« la purée », « les pommes de terre », « le riz »…).
const STARCH_WORDS = /\b(?:(?:la|une|de la|des|les|le|du) )?(?:pur[ée]e(?: (?:de pommes de terre|maison|au beurre|aux herbes))?|pommes de terre(?: (?:vapeur|sautées|rôties|grenaille))?|pommes vapeur|grenailles|frites(?: maison)?|riz(?: basmati| blanc)?|semoule|polenta|boulgour)\b/gi;
const PREP_VERB = /^(préparer|cuire|faire cuire|précuire|éplucher|écraser|rôtir|frire|faire gonfler)\b/i;
const NEUTRAL = /beurre|lait|crème|muscade|sel|poivre|huile|eau|bouillon/i;
/** Étapes du plat quand on change d'accompagnement : la préparation du féculent d'origine disparaît, ses mentions renvoient au nouvel accompagnement. */
export function adaptSteps(r: Recipe, removed: Set<string>, side: Recipe, idx: ItemIndex): string[] {
  const others = [...r.ingredients, ...r.meat].filter((i) => !removed.has(i.itemId)).map((i) => idx.get(i.itemId)?.name || "")
    .filter((n) => n && !NEUTRAL.test(n)).map((n) => norm(n).split(" ")[0]).filter((w) => w.length > 3);
  const label = `l'accompagnement (${side.name.toLowerCase()})`;
  const tidy = (x: string) => x.replace(/\s{2,}/g, " ").replace(/\s+([,.;])/g, "$1").replace(/^(\S+)\s+(et|,)\s+/i, "$1 ");
  return r.steps.flatMap((raw) => {
    const st = raw.replace(/\s*\([^)]*au choix\)/gi, "");
    STARCH_WORDS.lastIndex = 0;
    if (!STARCH_WORDS.test(st)) return [st];
    const rest = norm(st.replace(STARCH_WORDS, ""));
    if (PREP_VERB.test(st.trim())) {
      // Préparation du seul féculent : supprimée ; préparée avec autre chose : on n'en garde que l'autre chose.
      if (!others.some((w) => rest.includes(w))) return [];
      const s2 = tidy(st.replace(new RegExp(STARCH_WORDS.source + "\\s*(et|,)?\\s*", "gi"), ""));
      return [s2.charAt(0).toUpperCase() + s2.slice(1)];
    }
    let first = true;
    return [tidy(st.replace(STARCH_WORDS, () => (first ? ((first = false), label) : "")).replace(/\s+(et|,)\s*(?=[,.;]|et\b)/g, ""))];
  });
}

/** Recette effective d'un créneau de la semaine (plat + accompagnement choisi). */
export function slotRecipe(recipes: Map<string, Recipe>, slot: Pick<Slot, "recipeId" | "side" | "vegSide">, idx: ItemIndex): Recipe | undefined {
  const r = recipes.get(slot.recipeId);
  if (!r) return r;
  const a = slot.side ? withSide(r, recipes.get(slot.side), idx) : r;
  return slot.vegSide ? withVegSide(a, recipes.get(slot.vegSide), idx) : a;
}

// ---------------- Légumes servis à côté ----------------
// Familles de cuisines qui se marient ; un accompagnement « neutre » va avec toute la cuisine européenne (et américaine).
const GROUP: Record<string, string> = { belge: "eu", francaise: "eu", americaine: "us", italienne: "med", mediterraneenne: "med", asiatique: "as", indienne: "in", orientale: "or", latino: "la" };
const EURO = new Set(["eu", "med", "us"]);
// Aromates et condiments : ils ne font pas « le légume » d'un plat.
const AROMATIC = /^(ail|oignon|oignon rouge|oignons nouveaux|echalote|piment|persil|ciboulette|coriandre|basilic|menthe|thym|romarin|aneth|estragon|sauge|gingembre|citron|citron vert|citronnelle|laurier|feuille de laurier|cerfeuil|origan)$/;
const mainVegs = (r: Recipe, idx: ItemIndex, skip: Set<string> = new Set()) =>
  [...r.ingredients, ...r.meat].map((i) => i.itemId).filter((id) => !skip.has(id) && idx.get(id)?.category === "fl" && !AROMATIC.test(norm(idx.get(id)!.name)));
const PORK = /porc|saucisse|boudin|jambon|lard|cotelette|travers|chipolata|filet mignon|carbonnade de porc|cordon/;
const POULTRY = /poulet|dinde|canard|pintade|volaille|lapin|caille|coq|magret|chicken|pollo/;

/** Légume d'origine servi à côté (« salade verte », « haricots verts »), ou null s'il n'y en a pas de remplaçable. */
export const defaultVegLabel = (r: Recipe, idx: ItemIndex) =>
  r.vegSide?.length ? r.vegSide.map((id) => idx.get(id)?.name.toLowerCase()).filter(Boolean).join(" et ") : null;

/**
 * Accompagnements de légumes qu'un chef accepterait à la place du légume servi à côté :
 * de saison, de la même famille de cuisine (ou neutre), accordés à la protéine (« p » : viande, porc, volaille, poisson, vege),
 * sans viande pour un repas végé, sans doublon (légume ou lardons déjà dans le plat). Les 8 plus justes, salades d'abord si l'origine est une salade.
 */
export function vegOptions(r: Recipe, all: Iterable<Recipe>, idx: ItemIndex, veg = false, now = new Date()): Recipe[] {
  if (!r.vegSide?.length || (r.course || "plat") !== "plat") return [];
  const season = currentSeason(now);
  const p = profile(r, veg, idx).protein, name = norm(r.name);
  const want = p === "poisson" ? ["poisson"] : p === "viande" ? (POULTRY.test(name) ? ["volaille", "viande"] : PORK.test(name) ? ["porc", "viande"] : ["viande"]) : ["vege"];
  const g = GROUP[r.cuisine || "belge"];
  const original = new Set(r.vegSide);
  const inDish = new Set(mainVegs(r, idx, original));
  const dishMeat = new Set([...r.ingredients, ...r.meat].map((i) => i.itemId).filter((id) => idx.get(id)?.category === "vi"));
  const rawSalad = r.vegSide.some((id) => /salade|roquette|concombre/.test(norm(idx.get(id)?.name || "")));
  const isSalad = (x: Recipe) => /salade|slaw|concombre/.test(norm(x.name));
  return [...all].filter((x) => {
    if (x.course !== "accompagnement" || x.deleted || !x.pairs?.length || sideFamily(x, idx)) return false;
    if (!want.some((w) => x.pairs!.includes(w))) return false;
    if (!x.seasons.includes(season)) return false;
    const xg = GROUP[x.cuisine || "belge"];
    if (xg !== g && !(x.neutral && EURO.has(g))) return false;
    const vegs = mainVegs(x, idx);
    if (vegs.some((id) => inDish.has(id))) return false;
    if (vegs.length && vegs.every((id) => original.has(id))) return false; // même légume que celui d'origine
    const meat = [...x.ingredients, ...x.meat].filter((i) => idx.get(i.itemId)?.category === "vi").map((i) => i.itemId);
    if (meat.length && (p !== "viande" && !veg || meat.some((id) => dishMeat.has(id)))) return false;
    if (veg && x.ingredients.some((i) => idx.get(i.itemId)?.category === "vi")) return false; // végé : seulement si sa viande a une version végé
    return true;
  }).map((x) => ({ x, k: (x.cuisine === r.cuisine ? 4 : GROUP[x.cuisine || "belge"] === g ? 3 : 0) + (x.seasons.length < 4 ? 2 : 0) + (rawSalad && isSalad(x) ? 1 : 0) }))
    .sort((a, b) => b.k - a.k || a.x.prepMin - b.x.prepMin).map((o) => o.x)
    .slice(0, 8);
}

const VEG_PREP = /^(cuire|faire cuire|blanchir|laver|préparer|assaisonner|égoutter)\b/i;
/** Recette du repas avec un autre accompagnement de légumes : légume d'origine retiré, étapes adaptées, étapes de l'accompagnement à la suite. */
export function withVegSide(r: Recipe, side: Recipe | null | undefined, idx: ItemIndex): Recipe {
  if (!side || !r.vegSide?.length) return r;
  const removed = new Set(r.vegSide);
  const names = r.vegSide.map((id) => idx.get(id)?.name || "").filter(Boolean);
  // « la salade verte », « une salade », « les haricots verts »…
  const alt = names.flatMap((n) => [n, n.split(" ")[0]]).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`\\b(?:(?:la|une|de la|des|les|le|du|d'une|sa) )?(?:${alt.join("|")})s?\\b`, "gi");
  const label = `l'accompagnement de légumes (${side.name.toLowerCase()})`;
  const steps = r.steps.flatMap((st) => {
    re.lastIndex = 0;
    if (!re.test(st)) return [st];
    re.lastIndex = 0;
    const rest = st.replace(re, "").replace(/[\s,.;:]+/g, " ").trim();
    if (VEG_PREP.test(st.trim()) && rest.split(" ").length <= 6) return [];
    let first = true;
    re.lastIndex = 0;
    return [st.replace(re, () => (first ? ((first = false), label) : "")).replace(/\s{2,}/g, " ").replace(/\s+([,.;])/g, "$1").replace(/\s+(et|,)\s*(?=[,.;])/g, "")];
  });
  const extra = side.steps.length ? [`Légumes — ${side.name} :`, ...side.steps] : [`Légumes : ${side.name}.`];
  return { ...r, ingredients: [...r.ingredients.filter((i) => !removed.has(i.itemId)), ...side.ingredients],
    meat: [...r.meat, ...side.meat], vegSwap: [...r.vegSwap, ...side.vegSwap], steps: [...steps, ...extra], vegSideName: side.name };
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
 * Accompagnements proposés d'office pour la semaine : d'abord l'accord retenu par le foyer pour ce plat
 * (« boulettes sauce tomate → frites »), sinon un par plat où il est interchangeable, varié, même cuisine d'abord.
 */
export function assignSides<T extends Pick<Slot, "recipeId" | "side" | "fromLeftovers" | "vegSide">>(slots: T[], recipes: Map<string, Recipe>, idx: ItemIndex, rand = Math.random,
  remembered: Record<string, string | null> = {}, rememberedVeg: Record<string, string | null> = {}): T[] {
  const all = [...recipes.values()];
  // Légume servi à côté : seulement l'accord retenu par le foyer (sinon celui de la recette, la version classique).
  const withVeg = slots.map((sl) => {
    const r = recipes.get(sl.recipeId), m = r ? rememberedVeg[r.id] : undefined;
    return r && m && sl.vegSide === undefined && !sl.fromLeftovers && vegOptions(r, all, idx).some((x) => x.id === m) ? { ...sl, vegSide: m } : sl;
  });
  return assignStarch(withVeg, recipes, idx, rand, remembered, all);
}
function assignStarch<T extends Pick<Slot, "recipeId" | "side" | "fromLeftovers">>(slots: T[], recipes: Map<string, Recipe>, idx: ItemIndex, rand: () => number, remembered: Record<string, string | null>, all: Recipe[]): T[] {
  const used = new Set<string>();
  return slots.map((sl) => {
    const r = recipes.get(sl.recipeId);
    if (!r || sl.fromLeftovers || sl.side !== undefined) return sl;
    if (r.id in remembered) {
      const m = remembered[r.id];
      if (m === null) return { ...sl, side: null };
      if (m && sideOptions(r, all, idx).some((x) => x.id === m)) { used.add(m); return { ...sl, side: m }; }
    }
    const opts = sideOptions(r, all, idx).filter((x) => !used.has(x.id));
    const same = opts.filter((x) => x.cuisine === r.cuisine);
    const pool = (same.length ? same : opts).slice(0, 5);
    if (!pool.length) return sl;
    const pick = pool[Math.floor(rand() * pool.length)];
    used.add(pick.id);
    return { ...sl, side: pick.id };
  });
}
