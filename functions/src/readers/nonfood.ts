// Produits non alimentaires (animaux, entretien, hygiène et beauté) : ils ne se rangent jamais avec la nourriture.
// Une « pâtée pour chien au bœuf » n'est pas du bœuf, une « crème pour le corps » n'est pas de la crème.

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe");

const PETS = [
  "chat", "chats", "chaton", "chatons", "chien", "chiens", "chiot", "chiots", "animal", "animaux", "oiseau", "oiseaux", "rongeur", "rongeurs", "lapin nain",
  "patee", "litiere", "friandise pour", "friandises pour", "os a macher", "batonnets a macher", "a macher",
  "whiskas", "felix", "sheba", "pedigree", "purina", "royal canin", "friskies", "kitekat", "dreamies", "dentastix", "perfect fit", "brekkies", "vitakraft", "catisfaction", "ultima", "gourmet gold", "cesar",
];
const HYGIENE = [
  "shampooing", "shampoing", "apres-shampooing", "apres shampooing", "gel douche", "creme douche", "douche", "deodorant", "anti-transpirant", "dentifrice", "brosse a dents", "bain de bouche",
  "savon", "creme de jour", "creme de nuit", "creme visage", "creme mains", "creme pour les mains", "creme corps", "creme pour le corps", "creme solaire", "creme hydratante", "creme a raser", "anti-age", "anti-rides",
  "lait corporel", "lait demaquillant", "lait solaire", "lait hydratant", "lait pour le corps", "lotion", "demaquill", "mascara", "rouge a levres", "vernis", "maquillage", "fond de teint",
  "parfum", "eau de toilette", "eau de parfum", "rasoir", "rasoirs", "lames de rasoir", "mousse a raser", "gel a raser", "coton-tiges", "cotons", "disques demaquillants", "lingettes",
  "serviettes hygieniques", "tampons", "protege-slips", "couches", "laque", "gel coiffant", "coloration", "baume a levres", "serum", "masque visage", "masque cheveux", "exfoliant", "gommage", "soin du visage", "huile de massage", "huile pour le corps",
];
const CLEANING = [
  "nettoyant", "detergent", "lessive", "assouplissant", "adoucissant", "javel", "desinfect", "degraiss", "detartr", "anticalcaire", "anti-calcaire", "liquide vaisselle", "lave-vaisselle", "vaisselle",
  "eponge", "eponges", "serpillere", "essuie-tout", "papier toilette", "mouchoirs", "sac poubelle", "sacs poubelle", "desodorisant", "parfum d'ambiance", "insecticide", "cirage", "bloc wc", "gel wc", "vitres",
  "allume-feu", "bougie", "piles", "ampoule", "papier aluminium", "film etirable", "sacs congelation", "sacs de congelation", "papier cuisson",
];
const words = [...PETS, ...HYGIENE, ...CLEANING].map(fold);
// Mot entier (« chat » oui, « chataigne » non ; « cotons » oui, « côtes » non).
const RE = new RegExp(`(^|[^a-z0-9])(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?=$|[^a-z0-9])`);

/** Le produit n'est pas de la nourriture (ni une boisson) : animaux, entretien, hygiène, beauté. */
export const isNonFood = (name: string) => RE.test(fold(name));

/** Page d'un rayon non alimentaire (adresse de la page capturée). */
export const isNonFoodPage = (url: string) =>
  /animaux|dieren|huisdier|entretien|nettoyage|onderhoud|huishoud|droguerie|drogisterij|hygiene|verzorging|beaute|schoonheid|soins|parfumerie|lessive|was(middel)?\b/i.test(url || "");

/** Rayon « Hygiène & entretien » : le seul qui puisse recevoir un produit non alimentaire. */
export const HOUSEHOLD = "dr";
