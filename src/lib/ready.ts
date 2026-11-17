import type { Item, Recipe, Season } from "./types";
import { norm } from "./text";

/**
 * Plats préparés vendus en magasin (lasagne, hachis parmentier, pizza…) : à part des ingrédients.
 * Chacun devient une « recette » à réchauffer, pour profiter du coût, de la liste de courses et du stock.
 */

const ALL: Season[] = ["P", "E", "A", "H"];

/** Mots qui signalent viande ou poisson dans le nom d'un plat. */
const MEAT = /\b(poulets?|boeuf|veau|porc|dinde|agneau|jambon|lard|lardons|viandes?|hache|hachis|bolognaise|carbonara|saumon|thon|cabillaud|poissons?|scampis?|crevettes?|chorizo|salami|kebab|gyros|canard|lapin|cerf|marcassin|saucisses?|boulettes?|merguez|tartiflette|volaille|chili con carne|moules|pita|americain|cordon bleu|vol-au-vent|chicken|chevreuil|gibier|hochepot|moussaka|paella|hawai|barbecue|lorraine|croque-monsieur|mortadelle|pancetta|panchetta|carbonades?|stoemp saucisse|chicons au gratin)\b/;

export const isMeatyName = (name: string) => MEAT.test(norm(name).replace(/œ/g, "oe"));

/** Nombre de personnes indiqué sur l'emballage (« 2pers », « 4p », « pour 2 personnes »). */
export function packPersons(name: string): number | null {
  const m = norm(name).match(/(\d+)\s*(?:p|pers|personnes?)\b/);
  const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= 12 ? n : null;
}

/** Quantité d'un plat préparé pour une portion, dans l'unité de l'article. */
export function readyPortion(item: Pick<Item, "name" | "unit" | "packSize">): number {
  const n = packPersons(item.name);
  if (item.unit === "pc") return n ? 1 / n : 1;
  if (item.unit === "ml") return n && item.packSize > 0 ? item.packSize / n : 300;
  return n && item.packSize > 0 ? item.packSize / n : 350; // une portion adulte ≈ 350 g
}

export const READY_PREFIX = "pret-";
export const isReadyRecipe = (r: Pick<Recipe, "source">) => r.source === "pret";

/** Recette « à réchauffer » pour un plat préparé. Plat avec viande : l'article est aussi sa version végé (rien à remplacer). */
export function readyRecipe(item: Item): Recipe {
  const ing = { itemId: item.id, qtyPerPerson: readyPortion(item) };
  const meaty = isMeatyName(item.name);
  return {
    id: READY_PREFIX + item.id, name: item.name, vegName: null, seasons: ALL, prepMin: 15,
    ingredients: meaty ? [] : [ing], meat: meaty ? [ing] : [], vegSwap: meaty ? [ing] : [],
    steps: ["Réchauffer selon les indications de l'emballage.", "Servir avec une salade ou des crudités de saison pour compléter le repas."],
    source: "pret",
  };
}

/**
 * Repère un plat préparé d'après son nom (pour ranger le catalogue existant ; les nouveaux articles sont classés par l'IA).
 * Les bases de cuisine (pâte à pizza, sauce, feuilles de lasagne…) restent des ingrédients.
 */
const DISH = /\b(lasagnes?|hachis|parmentier|pizzas?|pinsa|calzones?|cannelloni|tartiflette|moussaka|gratin|plats?|repas|nouilles (au|aux|a la)|vol-au-vent|blanquette|civet|ragout|quiche|croque|wraps? (au poulet|au saumon|au thon|kebab)|risotto|paella|couscous (royal|au|aux|poulet|merguez)|chili con carne|tikka masala|butter chicken|osso buco|stoemp|chicons au gratin|hochepot|waterzooi|carbonades? (a la|flamandes?)|boulettes (sauce|a la liegeoise|liegeoises)|vol au vent|macaroni|spaghetti bolognaise|linguine (bolognaise|jambon|carbonara|au|aux)|tagliatelles? (carbonara|bolognaise|au)|penne (au|a la)|kit)\b/;
const BASE = /^(pate|pates|sauce|farine|levure|feuilles?|pain|fond|bouillon|garniture|fromage|epices?|melange d'epices|assaisonnement|creme|chips|crackers|biscuits?)\b/;

export function looksReady(name: string): boolean {
  const n = norm(name).replace(/œ/g, "oe");
  return DISH.test(n) && !BASE.test(n);
}
