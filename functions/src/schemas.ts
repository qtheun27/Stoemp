import { z } from "zod";

export const CAT = z.enum(["fl", "vi", "fr", "bo", "ep", "bs", "su", "dr"]);
export const UNIT = z.enum(["g", "ml", "pc"]);
export const ALLERGEN = z.enum(["gl", "la", "oe", "po", "fc", "so", "cr"]);

export const ClassifiedItem = z.object({
  name: z.string().describe("Nom générique et propre de l'article, au singulier sauf usage (ex. « Lait », « Papier toilette »)"),
  category: CAT,
  unit: UNIT,
  packSize: z.number().describe("Format courant en magasin, dans l'unité choisie"),
  local: z.boolean().describe("Produit couramment en Belgique"),
  organicAvailable: z.boolean(),
  perishable: z.boolean(),
  shelfLifeDays: z.number().int(),
  allergens: z.array(ALLERGEN),
  seasonMonths: z.array(z.number().int()).describe("Mois de saison en Belgique (1-12) pour fruits et légumes, sinon vide"),
  ready: z.boolean().describe("Plat préparé prêt à réchauffer ou à manger (lasagne, hachis parmentier, pizza, plat traiteur) ; false pour un ingrédient ou une base de cuisine (pâte à pizza, sauce, feuilles de lasagne)"),
});

/** Ingrédient tel que renvoyé par l'IA : article connu (itemId) ou nouvel article (newName). */
export const AiIngredient = z.object({
  itemId: z.string().nullable().describe("Identifiant exact d'un article du catalogue, ou null"),
  newName: z.string().nullable().describe("Nom générique si aucun article du catalogue ne convient, sinon null"),
  qtyPerPerson: z.number().describe("Quantité pour 1 personne dans l'unité de l'article (g, ml ou pièces)"),
  newCategory: CAT.nullable().describe("Pour un nouvel article (newName) : son rayon ; sinon null"),
  newUnit: UNIT.nullable().describe("Pour un nouvel article : g (vendu au poids), ml (liquide) ou pc (pièce) ; sinon null"),
  newAllergens: z.array(ALLERGEN).describe("Pour un nouvel article : ses allergènes ; sinon liste vide"),
});

export const CUISINES = ["belge", "francaise", "italienne", "mediterraneenne", "orientale", "asiatique", "indienne", "latino", "americaine"] as const;

export const AiRecipe = z.object({
  name: z.string(),
  vegName: z.string().nullable(),
  prepMin: z.number().int(),
  seasons: z.array(z.enum(["P", "E", "A", "H"])),
  ingredients: z.array(AiIngredient),
  meat: z.array(AiIngredient),
  vegSwap: z.array(AiIngredient),
  steps: z.array(z.string()),
  cuisine: z.enum(CUISINES).describe("Cuisine du plat : belge, francaise, italienne, mediterraneenne (grecque, espagnole), orientale (Maghreb, Moyen-Orient), asiatique, indienne, latino (Mexique, Amérique latine), americaine (et anglaise)"),
});
export const AiRecipes = z.object({ recipes: z.array(AiRecipe) });
/** Relecture « chef critique » d'un lot de recettes de la bibliothèque. */
export const LibReview = z.object({ verdicts: z.array(z.object({
  index: z.number().int(),
  ok: z.boolean().describe("true seulement si c'est un vrai plat connu sous ce nom ET que la recette est correcte et réalisable"),
  reason: z.string().describe("Une phrase : pourquoi c'est refusé, ou « ok »"),
})) });
/** Recettes de la bibliothèque : avec le type de plat (plat principal, entrée, dessert). */
export const LIB_COURSES = ["aperitif", "entree", "soupe", "plat", "accompagnement", "dessert", "patisserie", "petitdej"] as const;
export const LibRecipes = z.object({ recipes: z.array(AiRecipe.extend({ course: z.enum(LIB_COURSES) })) });

export const Match = z.object({ index: z.number().int().nullable().describe("Indice du produit correspondant, ou null si aucun") });

export const ReceiptLine = z.object({
  label: z.string().describe("Libellé tel qu'imprimé"),
  name: z.string().describe("Nom générique de l'article en français (ex. « Lait », « Pâtes »)"),
  quantity: z.number().describe("Nombre d'unités ou de paquets achetés"),
  packSize: z.number().nullable().describe("Contenance d'un paquet dans l'unité ci-dessous, si lisible"),
  unit: UNIT.nullable(),
  totalPrice: z.number().describe("Prix total payé pour la ligne en euros, remises comprises"),
});
export const Receipt = z.object({
  store: z.enum(["colruyt", "renmans", "delhaize", "carrefour", "lidl", "aldi", "intermarche", "ah", "autre"]),
  date: z.string().nullable().describe("Date d'achat AAAA-MM-JJ"),
  lines: z.array(ReceiptLine),
});

export const PageProducts = z.object({
  products: z.array(z.object({
    name: z.string(), brand: z.string().nullable(), packSize: z.number().nullable(), packUnit: UNIT.nullable(),
    price: z.number(), pricePerUnitLabel: z.string().nullable(), promo: z.string().nullable(), organic: z.boolean(),
  })),
});

export const PageMatches = z.object({
  matches: z.array(z.object({ index: z.number().int(), itemId: z.string().nullable().describe("Identifiant exact d'un article du catalogue, ou null") })),
});

/** Classement par lots des produits inconnus en articles génériques (enrichissement du catalogue). */
export const NewItems = z.object({
  items: z.array(z.object({
    index: z.number().int(),
    keep: z.boolean().describe("false si ce n'est pas un article de courses alimentaire ou ménager utile (ex. décoration)"),
    name: z.string().describe("Nom générique sans marque, en français, comme dans une liste de courses (ex. « Framboises », « Pleurotes »)"),
    category: CAT, unit: UNIT,
    packSize: z.number().describe("Format courant en magasin, dans l'unité choisie"),
    local: z.boolean(), organicAvailable: z.boolean(), perishable: z.boolean(), shelfLifeDays: z.number().int(),
    allergens: z.array(ALLERGEN),
    seasonMonths: z.array(z.number().int()).describe("Mois de saison en Belgique (1-12) pour fruits et légumes, sinon vide"),
    ready: z.boolean().describe("Plat préparé prêt à réchauffer ou à manger (lasagne, hachis parmentier, pizza, plat traiteur) ; false pour un ingrédient ou une base de cuisine"),
  })),
});
