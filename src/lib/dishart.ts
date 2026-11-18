import { ingredientsOf, type ItemIndex } from "./catalog";
import { norm } from "./text";
import type { Recipe } from "./types";

/**
 * Illustration d'un plat déduite de sa recette (aucune image à stocker) : contenant selon le type de plat,
 * puis féculent, protéine, légumes, sauce et garnitures selon les ingrédients réels.
 */
export type Vessel = "plate" | "bowl" | "cup" | "slice" | "tart" | "board" | "cookies" | "glass" | "stack" | "waffle" | "mug";
export type Starch = "frites" | "puree" | "riz" | "pates" | "nouilles" | "pdt" | "semoule" | "pain" | "gnocchi" | "polenta";
export type Protein = "poisson" | "crevettes" | "moules" | "volaille" | "viande" | "saucisse" | "charcuterie" | "oeuf" | "tofu" | "legumineuses" | "fromage";
export type Veg = "carotte" | "brocoli" | "tomate" | "champignon" | "poivron" | "courgette" | "epinard" | "pois" | "chou" | "aubergine" | "haricot" | "oignon" | "mais" | "avocat" | "courge" | "salade" | "radis" | "asperge" | "betterave" | "concombre";
export type Garnish = "herbes" | "citron" | "fromage" | "sesame";
export interface ArtSpec { vessel: Vessel; starch: Starch | null; protein: Protein | null; veg: Veg[]; sauce: string | null; color: string; garnish: Garnish[]; seed: number }

const test = (re: RegExp, s: string) => re.test(s);
const STARCHES: [Starch, RegExp][] = [
  ["frites", /\bfrites?\b|croquette/], ["gnocchi", /gnocchi/], ["polenta", /polenta/],
  ["pates", /\bpates\b|spaghetti|tagliatelle|lasagne|cannelloni|orzo|tortellini/], ["nouilles", /nouille|vermicelle/],
  ["riz", /\briz\b(?! gluant)(?!.*vinaigre)/], ["semoule", /semoule|boulgour|couscous|quinoa|frik|epeautre|orge/],
  ["pdt", /pommes? de terre|grenaille/], ["pain", /\bpain\b|baguette|pistolet|pita|tortilla|naan|bagel|muffins anglais|biscotte|pate a pizza/],
];
const PROTEINS: [Protein, RegExp][] = [
  ["crevettes", /scampi|crevette|crabe/], ["moules", /moule/], ["poisson", /cabillaud|saumon|truite|sole|thon frais|thon \(boite\)|\bbar\b|haddock|sardine|merlan|anguille|raie|poisson/],
  ["volaille", /poulet|dinde|pintade|canard|magret|ailes/], ["saucisse", /saucisse|merguez|chorizo|boudin/],
  ["charcuterie", /lardon|bacon|jambon|salami/], ["viande", /boeuf|steak|bavette|agneau|gigot|porc|joue|roti|veau|hache|cotelette|travers|lapin|americain/],
  ["tofu", /tofu|galettes vegetales/], ["fromage", /halloumi|paneer|feta|provolone|mozzarella|raclette/],
  ["legumineuses", /lentille|pois chiche|haricots (rouges|blancs|noirs)|pois casses|feves|edamame/], ["oeuf", /oeuf/],
];
const VEGS: [Veg, RegExp][] = [
  ["carotte", /carotte/], ["brocoli", /brocoli|chou-fleur/], ["tomate", /tomate/], ["champignon", /champignon/], ["poivron", /poivron|piment/],
  ["courgette", /courgette/], ["epinard", /epinard|cresson|oseille/], ["pois", /petits pois|pois mange/], ["chou", /\bchou\b|chicon|choucroute|pak choi/],
  ["aubergine", /aubergine/], ["haricot", /haricots verts/], ["oignon", /oignon|echalote|poireau/], ["mais", /\bmais\b/], ["avocat", /avocat/],
  ["courge", /potiron|butternut|patate douce|courge/], ["salade", /salade|roquette|mache|iceberg/], ["radis", /radis/], ["asperge", /asperge/],
  ["betterave", /betterave/], ["concombre", /concombre/],
];
const SAUCES: [string, RegExp][] = [
  ["#d97a2b", /curry|curcuma|garam|massaman|ras el hanout|tikka/], ["#c43d2c", /tomates concassees|sauce tomate|concentre de tomate|harissa|paprika|gochujang|achiote/],
  ["#6b2c22", /vin rouge|biere brune|stoof/], ["#7a4a26", /sauce soja|sauce huitre|teriyaki|miso/], ["#6e9a3a", /pesto|chermoula|chimichurri/],
  ["#f1e3c4", /creme|bechamel|lait de coco|fromage blanc|yaourt|lait\b|tahini/], ["#d9b44a", /moutarde/],
];
const SOUPS: [string, RegExp][] = [
  ["#c9452f", /tomate|poivron|betterave/], ["#e58a2d", /carotte|potiron|butternut|courge|lentilles corail|patate douce/],
  ["#7aa441", /poireau|cresson|epinard|petits pois|cerfeuil|brocoli|oseille|asperge/], ["#a07a52", /champignon|chataigne|miso/],
  ["#5a3b2a", /haricots noirs|feves/], ["#e9dcb8", /chou-fleur|pommes de terre|chicon|mais/],
];
const SWEETS: [string, RegExp][] = [
  ["#5b3424", /chocolat|cacao|brownie|nutella/], ["#de4f68", /fraise|framboise|cerise|griotte|fruits rouges|myrtille/],
  ["#f0cf47", /citron|lemon/], ["#f2a33a", /mangue|passion|orange|abricot|peche/], ["#e2a74a", /pomme|poire|banane|plantain/],
  ["#a9c46a", /pistache|matcha/], ["#b9773e", /cafe|tiramisu|speculoos|caramel|cassonade|sirop|dulce|miel|datte|pain d'epices/],
];

const SWEET_BREAKFAST = /pancake|crepe|gaufre|pain perdu|brioche|croissant|cornett|couque|pain au|porridge|granola|muesli|confiture|chocolat chaud|baghrir|msemen|harcha|suikerbrood|cramique|bougatsa|kaya|melonpan|magdalena|ensaimada|maritozzi|bomboloni|sfenj|mantou/;

/** Petit hachage stable : la même recette donne toujours le même dessin. */
const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

export function artSpec(r: Recipe, idx: ItemIndex): ArtSpec {
  const course = r.course || "plat";
  const ingr = ingredientsOf(r, false).map((i) => ({ q: i.qtyPerPerson, it: idx.get(i.itemId) })).filter((x) => x.it)
    .sort((a, b) => b.q - a.q).map((x) => norm(x.it!.name));
  const meat = r.meat.map((i) => norm(idx.get(i.itemId)?.name || ""));
  const all = ingr.join(" | "), name = norm(r.name), both = `${name} | ${all}`;
  const first = <T,>(list: [T, RegExp][], s: string) => list.find(([, re]) => test(re, s))?.[0] ?? null;

  let starch = first(STARCHES, all.replace(/vinaigre de riz|vin de riz|farine de riz[^|]*|riz aplati[^|]*/g, ""));
  if (starch === "pdt" && /pure|stoemp|ecrase|mash|hachis|parmentier/.test(name)) starch = "puree";
  if (/frites/.test(name)) starch = "frites";
  const protein = first(PROTEINS, meat.join(" | ")) ?? first(PROTEINS, all.replace(/fumet[^|]*|nuoc[^|]*|anchois[^|]*|bouillon[^|]*/g, ""));
  const veg: Veg[] = [];
  for (const s of ingr) {
    const v = first(VEGS, s);
    // Oignon, échalote, poireau : aromates, dessinés seulement quand ils sont au cœur du plat.
    if (v === "oignon" && !/oignon|poireau|echalote/.test(name)) continue;
    if (v && !veg.includes(v)) veg.push(v);
    if (veg.length >= 3) break;
  }
  const sauce = first(SAUCES, all);
  const garnish: Garnish[] = [];
  if (/persil|coriandre|basilic|ciboulette|menthe|aneth|cerfeuil|estragon|oignons nouveaux/.test(all)) garnish.push("herbes");
  if (/citron/.test(all)) garnish.push("citron");
  if (/parmesan|gruyere|emmental|comte|pecorino|cheddar/.test(all)) garnish.push("fromage");
  if (/sesame/.test(all)) garnish.push("sesame");

  let vessel: Vessel = "plate";
  let color = sauce || "#efe6d2";
  if (/\bchai\b|cafe de olla|chocolat chaud|lassi|\bthe\b/.test(name)) { vessel = "mug"; color = first(SWEETS, both) || "#c9a27a"; }
  else if (course === "soupe") { vessel = "bowl"; color = first(SOUPS, all) || sauce || "#e2c48f"; }
  else if (course === "dessert" || course === "patisserie" || (course === "petitdej" && (SWEET_BREAKFAST.test(name) || (!protein && !veg.length)))) {
    color = first(SWEETS, both) || "#ecd3a0";
    // L'ordre compte : une verrine au spéculoos reste une verrine, une tarte aux biscuits reste une tarte.
    if (/glace|gelato|sorbet|granita|kulfi|semifreddo|dame blanche|liegeois|melba|affogato|helene/.test(both)) vessel = "cup";
    else if (/mousse|creme|pots?|panna|riz au lait|arroz|pudding|tiramisu|zabaione|verrine|kheer|mishti|shrikhand|serradura|trifle|eton|mess|yaourt|charlotte|ile flottante|tapioca|annin|mango|lassi|bonet|flan de|natillas/.test(name)) vessel = "glass";
    else if (/gaufre/.test(name)) vessel = "waffle";
    else if (/tarte|tart|crostata|pecan|pie\b|tatin|mille-feuille|galette des rois|pastiera|tarte au flan/.test(name)) vessel = "tart";
    else if (/crepe|pancake|pain perdu|dorayaki|hotteok|msemen|baghrir|harcha|blinis|uttapam|chilla/.test(name)) vessel = "stack";
    else if (/biscuit|cookie|sable|speculoos|madeleine|financier|amaretti|ghriba|kourabiedes|cantucci|macaron|baci|beignet|churros|loukoum|bomboloni|berlin|chouquette|ladoo|barfi|brigadeiro|cocada|jian dui|kaak|fekkas|taralli|polvoron|shortbread|scone|muffin|magdalena|croissant|cornett|pain au|couque|melonpan|mochi|dattes|sfenj|koulouri|pretzel|grissini/.test(name)) vessel = "cookies";
    else vessel = course === "dessert" ? "glass" : "slice";
  } else if (course === "aperitif") vessel = "board";
  return { vessel, starch, protein, veg, sauce, color, garnish, seed: hash(r.id || r.name) };
}
