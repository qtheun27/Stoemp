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
});

/** Ingrédient tel que renvoyé par l'IA : article connu (itemId) ou nouvel article (newName). */
export const AiIngredient = z.object({
  itemId: z.string().nullable().describe("Identifiant exact d'un article du catalogue, ou null"),
  newName: z.string().nullable().describe("Nom générique si aucun article du catalogue ne convient, sinon null"),
  qtyPerPerson: z.number().describe("Quantité pour 1 personne dans l'unité de l'article (g, ml ou pièces)"),
});

export const AiRecipe = z.object({
  name: z.string(),
  vegName: z.string().nullable(),
  prepMin: z.number().int(),
  seasons: z.array(z.enum(["P", "E", "A", "H"])),
  ingredients: z.array(AiIngredient),
  meat: z.array(AiIngredient),
  vegSwap: z.array(AiIngredient),
  steps: z.array(z.string()),
});
export const AiRecipes = z.object({ recipes: z.array(AiRecipe) });

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
