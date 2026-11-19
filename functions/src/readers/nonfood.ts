// Produits non alimentaires (animaux, entretien, hygiène et beauté) : ils ne se rangent jamais avec la nourriture.
// Une « pâtée pour chien au bœuf » n'est pas du bœuf, une « crème pour le corps » n'est pas de la crème.

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe");

const PETS = [
  // « oiseau » seul est un mot de cuisine (oiseaux sans tête, langues d'oiseau) : seulement « pour oiseaux ».
  "chat", "chats", "chaton", "chatons", "chien", "chiens", "chiot", "chiots", "animal", "animaux", "pour oiseaux", "graines pour oiseaux", "rongeur", "rongeurs", "lapin nain",
  "patee", "litiere", "friandise pour", "friandises pour", "os a macher", "batonnets a macher", "a macher",
  "whiskas", "felix", "sheba", "pedigree", "purina", "royal canin", "friskies", "kitekat", "dreamies", "dentastix", "perfect fit", "brekkies", "vitakraft", "catisfaction", "ultima", "gourmet gold", "frolic", "catmilk", "hill's", "pro plan", "josera", "applaws", "animonda", "catessy", "schesir", "butcher's",
];
const HYGIENE = [
  "shampooing", "shampoing", "apres-shampooing", "apres shampooing", "gel douche", "creme douche", "douche", "deodorant", "anti-transpirant", "dentifrice", "brosse a dents", "bain de bouche",
  "savon", "creme de jour", "creme de nuit", "creme visage", "creme mains", "creme pour les mains", "creme corps", "creme pour le corps", "creme solaire", "creme hydratante", "creme a raser", "anti-age", "anti-rides",
  "lait corporel", "lait demaquillant", "lait solaire", "lait hydratant", "lait pour le corps", "lotion", "demaquill", "mascara", "rouge a levres", "vernis", "maquillage", "fond de teint",
  "parfum", "eau de toilette", "eau de parfum", "rasoir", "rasoirs", "lames de rasoir", "mousse a raser", "gel a raser", "coton-tiges", "cotons", "disques demaquillants", "lingettes",
  "nivea", "ogx", "garnier", "l'oreal", "colgate", "sanex", "palmolive", "rexona", "gillette", "pampers", "head & shoulders",
  "serviettes hygieniques", "tampons", "protege-slips", "couches", "laque", "gel coiffant", "coloration", "baume a levres", "serum", "masque visage", "masque cheveux", "exfoliant", "gommage", "soin du visage", "huile de massage", "huile pour le corps", "huile de soin", "huile de bain", "johnson's", "huile bebe", "baby huile", "baby oil", "bio-oil", "micellaire", "dch",
];
const CLEANING = [
  "nettoy", "a recurer", "creme a recurer", "dreft", "ariel", "mr propre", "cif", "ajax", "dettol", "glorix", "frosch", "ecover", "vanish", "finish", "regenerant", "sel regenerant", "sel lave-vaisselle",
  "nettoyant", "detergent", "lessive", "assouplissant", "adoucissant", "javel", "desinfect", "degraiss", "detartr", "anticalcaire", "anti-calcaire", "liquide vaisselle", "lave-vaisselle", "vaisselle",
  "eponge", "eponges", "serpillere", "essuie-tout", "papier toilette", "mouchoirs", "sac poubelle", "sacs poubelle", "desodorisant", "parfum d'ambiance", "insecticide", "cirage", "bloc wc", "gel wc", "vitres",
  "allume-feu", "bougie", "piles", "ampoule", "papier aluminium", "film etirable", "sacs congelation", "sacs de congelation", "papier cuisson",
];
const words = [...PETS, ...HYGIENE, ...CLEANING].map(fold);
// Mot entier (« chat » oui, « chataigne » non ; « cotons » oui, « côtes » non).
const RE = new RegExp(`(^|[^a-z0-9])(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?=$|[^a-z0-9])`);

/** Le produit n'est pas de la nourriture (ni une boisson) : animaux, entretien, hygiène, beauté. */
export const isNonFood = (name: string) => RE.test(fold(name));

/** Alimentation pour bébé (petits pots « +12m », laits de croissance) : jamais rangée avec les ingrédients de cuisine. */
// « +12m », « 6m+ », « 6-36m » ou une marque pour bébé ; pas « parmigiano 24m » ni « serrano 12m » (affinage).
export const isBabyFood = (name: string) =>
  /\+\s?\d{1,2}\s?m(ois)?\b|\b\d{1,2}\s?m\s?\+|\b\d{1,2}\s?-\s?\d{1,2}\s?m\b|\bolvarit\b|\bnutrilon\b|\bbambix\b|\byogolino\b|\bcerelac\b|hero baby|ella'?s kitchen|\bbetterfood\b|\bdixap\b|\bbabybio\b|nan optipro|\bbaby\b|\bbebe\b|petits? pots?\b|des \d+ mois|lait de (suite|croissance)|lait croissance|nourrisson|premier age/.test(fold(name));
/** Article destiné aux bébés et jeunes enfants : il garde ses produits pour bébé. */
export const isBabyItem = (name: string) => /infantile|nourrisson|bebe|enfant|premier age|croissance|lait de suite|petits? pots?/.test(fold(name));

/** Page d'un rayon non alimentaire (adresse de la page capturée). */
export const isNonFoodPage = (url: string) =>
  /animaux|dieren|huisdier|entretien|nettoyage|onderhoud|huishoud|droguerie|drogisterij|hygiene|verzorging|beaute|schoonheid|soins|parfumerie|lessive|was(middel)?\b/i.test(url || "");

/** Rayon « Hygiène & entretien » : le seul qui puisse recevoir un produit non alimentaire. */
export const HOUSEHOLD = "dr";
