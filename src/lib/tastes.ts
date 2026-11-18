import { ingredientsOf, isVegRecipe, type ItemIndex } from "./catalog";
import { norm } from "./text";
import type { Allergen, Cuisine, Recipe } from "./types";

/** Profil de goûts d'un membre du foyer (rempli par lui-même ou, pour un enfant, par un adulte). */
export interface Person {
  id: string;
  name: string;
  age: "enfant" | "ado" | "adulte";
  diet: "tout" | "sans-porc" | "pesco" | "vege";
  allergens: Allergen[];
  /** Groupes d'ingrédients refusés (« Jamais dans mon assiette ») et adorés (clés de TASTE_GROUPS). */
  never: string[];
  loves: string[];
  cuisines: Cuisine[];
  /** Piquant : 0 pas du tout … 3 très relevé. */
  spice: 0 | 1 | 2 | 3;
  /** 0 classiques rassurants, 1 un peu de découverte, 2 j'adore découvrir. */
  curious: 0 | 1 | 2;
  /** Pour la personne qui cuisine : minutes disponibles en semaine (0 = ne cuisine pas). */
  cookMin?: number;
}

/** Avis d'un membre sur un plat : 1 adoré, 0 bof, -1 non merci. */
export type Rating = 1 | 0 | -1;
export interface Tastes { people: Person[]; ratings: Record<string, Record<string, Rating>> }
export const EMPTY_TASTES: Tastes = { people: [], ratings: {} };

/** Groupes d'ingrédients clivants ou appréciés, reconnus par mots du nom de l'article (ou par allergène). */
export const TASTE_GROUPS: Record<string, { label: string; icon: string; words?: string[]; allergen?: Allergen }> = {
  champignons: { label: "Champignons", icon: "🍄", words: ["champignon"] },
  poisson: { label: "Poisson", icon: "🐟", allergen: "po" },
  fruitsdemer: { label: "Fruits de mer", icon: "🦐", allergen: "cr", words: ["moule", "scampi", "crevette", "crabe"] },
  porc: { label: "Porc", icon: "🐖", words: ["porc", "lardon", "bacon", "jambon", "saucisse", "chorizo", "salami", "travers", "boudin"] },
  boeuf: { label: "Bœuf", icon: "🐄", words: ["boeuf", "bœuf", "bavette", "steak", "hache de boeuf", "rosbif"] },
  poulet: { label: "Poulet", icon: "🐔", words: ["poulet", "dinde", "pintade"] },
  agneau: { label: "Agneau", icon: "🐑", words: ["agneau", "gigot", "merguez"] },
  lapin: { label: "Lapin", icon: "🐇", words: ["lapin"] },
  abats: { label: "Abats", icon: "🫀", words: ["rognon", "foie", "joues"] },
  chicons: { label: "Chicons", icon: "🥬", words: ["chicon"] },
  choux: { label: "Choux", icon: "🥦", words: ["chou", "brocoli", "choucroute"] },
  aubergine: { label: "Aubergine", icon: "🍆", words: ["aubergine"] },
  poivron: { label: "Poivron", icon: "🫑", words: ["poivron"] },
  olives: { label: "Olives", icon: "🫒", words: ["olive"] },
  coriandre: { label: "Coriandre", icon: "🌿", words: ["coriandre"] },
  fromagefort: { label: "Fromages forts", icon: "🧀", words: ["fromage bleu", "herve", "chevre", "feta"] },
  legumineuses: { label: "Légumineuses", icon: "🫘", words: ["lentille", "pois chiche", "haricots rouges", "haricots blancs", "haricots noirs", "pois casses", "feves"] },
  pates: { label: "Pâtes", icon: "🍝", words: ["pates", "spaghetti", "tagliatelle", "lasagne", "gnocchi", "cannelloni", "nouilles", "orzo"] },
  riz: { label: "Riz", icon: "🍚", words: ["riz"] },
  pommesdeterre: { label: "Pommes de terre", icon: "🥔", words: ["pommes de terre", "grenaille", "frites", "croquettes"] },
  fromage: { label: "Fromage fondu", icon: "🫕", words: ["gruyere", "emmental", "mozzarella", "comte", "raclette", "cheddar", "parmesan"] },
  coco: { label: "Lait de coco", icon: "🥥", words: ["lait de coco", "noix de coco"] },
  tofu: { label: "Tofu", icon: "🧊", words: ["tofu"] },
};
/** Mots d'ingrédients « qui piquent ». */
const SPICY_WORDS = ["piment", "harissa", "curry", "chili", "fajitas", "gochujang", "doubanjiang", "sriracha", "jalapeno", "wasabi", "sauce piquante"];

const names = (r: Recipe, veg: boolean, idx: ItemIndex) => ingredientsOf(r, veg).map((i) => idx.get(i.itemId)).filter((x): x is NonNullable<typeof x> => !!x);
const hasWord = (text: string, w: string) => ` ${norm(text)} `.includes(` ${norm(w)}`);

/** Le plat (version avec ou sans viande) contient-il ce groupe d'ingrédients ? */
export function hasGroup(r: Recipe, key: string, veg: boolean, idx: ItemIndex): boolean {
  const g = TASTE_GROUPS[key];
  if (!g) return false;
  return names(r, veg, idx).some((it) => (g.allergen && it.allergens.includes(g.allergen)) || (g.words || []).some((w) => hasWord(it.name, w)))
    || (g.words || []).some((w) => hasWord(r.name, w));
}
export const isSpicy = (r: Recipe, veg: boolean, idx: ItemIndex) => names(r, veg, idx).some((it) => SPICY_WORDS.some((w) => hasWord(it.name, w)));

/** Ce membre mange-t-il la version végé du plat ? */
const eatsVeg = (p: Person, r: Recipe, idx: ItemIndex) =>
  p.diet === "vege" || (p.diet === "pesco" && !hasGroup(r, "poisson", false, idx)) || (p.diet === "sans-porc" && hasGroup(r, "porc", false, idx));

/**
 * Envie d'un membre pour un plat (1 = neutre). Quasi nul si le plat contient un de ses « jamais »
 * ou s'il ne peut pas le manger (pas de version végé) ; plus haut pour ce qu'il adore ou a déjà aimé.
 */
export function personScore(p: Person, r: Recipe, tastes: Tastes, idx: ItemIndex): number {
  const veg = eatsVeg(p, r, idx);
  if (veg && !isVegRecipe(r) && !r.vegSwap.length) return 0.02;
  if (p.never.some((k) => hasGroup(r, k, veg, idx))) return 0.02;
  let s = 1;
  const rating = tastes.ratings[p.id]?.[r.id];
  if (rating === 1) s *= 2.2; else if (rating === 0) s *= 0.7; else if (rating === -1) return 0.05;
  const loved = p.loves.filter((k) => hasGroup(r, k, veg, idx)).length;
  s *= 1 + 0.4 * Math.min(2, loved);
  if (r.cuisine && p.cuisines.length) s *= p.cuisines.includes(r.cuisine) ? 1.5 : 0.85;
  if (isSpicy(r, veg, idx)) s *= [0.25, 0.7, 1, 1.25][p.spice];
  // Curiosité : les « classiques » préfèrent les plats de base, les curieux la grande bibliothèque.
  if (p.curious === 0) s *= r.lib ? 0.75 : 1.15; else if (p.curious === 2) s *= r.lib ? 1.2 : 0.95;
  return s;
}

/**
 * Envie du groupe : moyenne géométrique des envies de chacun. Un plat détesté par un seul membre
 * descend nettement, un plat qui plaît à tous monte : c'est un repas pour toute la table.
 */
export function groupScore(r: Recipe, tastes: Tastes, idx: ItemIndex, people = tastes.people): number {
  if (!people.length) return 1;
  const logs = people.map((p) => Math.log(personScore(p, r, tastes, idx)));
  return Math.exp(logs.reduce((a, b) => a + b, 0) / logs.length);
}

/** Allergies de tous les membres : elles valent pour tout le repas. */
export const allAllergens = (people: Person[]) => [...new Set(people.flatMap((p) => p.allergens))];

/** Composition du foyer déduite des profils (adultes, ados, enfants, végétariens). */
export function eatersFromPeople(people: Person[]) {
  const n = (a: Person["age"]) => people.filter((p) => p.age === a).length;
  return { adults: n("adulte"), teens: n("ado"), kids: n("enfant"), vegEaters: people.filter((p) => p.diet === "vege").length };
}

/** Plats à faire noter dans le jeu « Ça te tente ? » : variés (cuisines, viandes), pas encore notés par ce membre. */
export function tastingDeck(pool: Recipe[], person: Person, tastes: Tastes, n = 20, rand = Math.random): Recipe[] {
  const done = tastes.ratings[person.id] || {};
  const left = pool.filter((r) => !(r.id in done)).sort(() => rand() - 0.5);
  const out: Recipe[] = [], perCuisine = new Map<string, number>();
  for (const r of left) {
    const c = r.cuisine || "?";
    if ((perCuisine.get(c) || 0) >= Math.ceil(n / 6)) continue;
    perCuisine.set(c, (perCuisine.get(c) || 0) + 1);
    out.push(r);
    if (out.length >= n) break;
  }
  return out;
}

export const newPerson = (name: string): Person => ({
  id: `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, name, age: "adulte", diet: "tout",
  allergens: [], never: [], loves: [], cuisines: [], spice: 1, curious: 1,
});
