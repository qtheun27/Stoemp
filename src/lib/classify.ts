import type { Cat } from "./types";
import { norm } from "./text";

// Dictionnaire de rangement par rayon (repris et étendu du prototype). L'IA prend le relais si rien ne correspond.
const GR: Record<Cat, string[]> = {
  dr: ["papier toilette", "pq\\b", "essuie", "sopalin", "dentifrice", "brosse a dent", "shampo", "savon", "gel douche", "lessive", "adoucissant", "liquide vaisselle", "pastille", "eponge", "sac poubelle", "sacs poubelle", "mouchoir", "couche", "lange", "lingette", "deodorant", "deo\\b", "rasoir", "coton", "javel", "nettoyant", "produit", "aluminium", "papier cuisson", "film alimentaire", "ampoule", "pile", "litiere", "croquettes pour"],
  bs: ["eau\\b", "eaux", "jus", "soda", "coca", "cola", "limonade", "biere", "vin\\b", "cidre", "ice tea", "the glace", "sirop de grenadine", "lait d'avoine", "boisson"],
  vi: ["poulet", "boeuf", "porc", "veau", "agneau", "dinde", "hache", "saucisse", "lardon", "jambon", "poisson", "saumon", "cabillaud", "crevette", "steak", "viande", "canard", "chorizo", "merguez", "lapin", "boulette", "pave", "filet de", "charcuterie", "salami", "pate de campagne", "americain", "boudin", "cervelas", "gyros", "scampi", "moule"],
  fl: ["carotte", "oignon", "ail\\b", "tomate", "pomme", "poireau", "courgette", "salade", "poivron", "champignon", "chou", "celeri", "citron", "persil", "herbe", "epinard", "haricot vert", "brocoli", "potiron", "courge", "aubergine", "concombre", "avocat", "echalote", "navet", "radis", "patate", "banane", "fruit", "menthe", "basilic", "ciboulette", "coriandre", "gingembre", "chicon", "endive", "legume", "fenouil", "betterave", "orange", "poire", "laitue", "raisin", "fraise", "kiwi", "mangue", "clementine", "mandarine", "melon", "peche", "abricot", "prune", "cerise", "myrtille", "framboise", "ananas", "pamplemousse", "roquette", "mache", "cresson"],
  fr: ["lait\\b", "lait demi", "lait entier", "creme", "beurre", "fromage", "yaourt", "oeuf", "mozza", "feta", "parmesan", "emmental", "gruyere", "ricotta", "tofu", "pate feuilletee", "pate brisee", "pate a pizza", "mascarpone", "comte", "chevre", "skyr", "margarine", "boursin", "houmous"],
  bo: ["pain", "baguette", "brioche", "croissant", "pistolet", "cramique", "craquelin", "sandwich", "couque", "gaufre"],
  su: ["surgel", "glace", "creme glacee"],
  ep: [],
};
const ORDER: Cat[] = ["dr", "bs", "su", "vi", "fl", "fr", "bo"];

export function guessCategory(name: string): Cat | null {
  const n = norm(name);
  for (const c of ORDER) if (GR[c].some((k) => new RegExp("(^|[^a-z])" + k).test(n))) return c;
  return null;
}
