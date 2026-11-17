import { ingredientsOf, isVegRecipe } from "./catalog";
import { slotPortions } from "./household";
import type { Ingredient, Recipe, Settings, Slot } from "./types";
import { norm } from "./text";

/**
 * Foyer mixte : un seul plat pour tout le monde ; pour les parts végé, la viande est remplacée
 * par la variante végé de la recette, avec une protéine végétale (lentilles, pois chiches, œufs…).
 */

/** Articles qui apportent des protéines dans une variante végé. */
const PROTEIN = /lentil|pois-chiches|tofu|haricots-rouges|haricots-blancs|oeuf|tempeh|seitan|halloumi|feta|mozzarella|chevre|ricotta|comte|parmesan|fromage|houmous|falafel|galettes-vegetales|quinoa|noix|cajou/;

/** Protéine ajoutée quand la variante végé n'en a pas, selon le plat (quantité pour 1 part). */
export function proteinFor(r: Recipe, allergens: string[] = []): Ingredient {
  const n = norm(r.name);
  if (/pates|lasagne|bolognaise|spaghetti|risotto|chili|hachis|parmentier|sauce/.test(n)) return { itemId: "lentilles-corail", qtyPerPerson: 40 };
  if (!allergens.includes("oe") && /soupe|veloute|croque|gratin|tartiflette|carbonara|quiche|flamiche|omelette/.test(n)) return { itemId: "oeufs", qtyPerPerson: 1 };
  return { itemId: "pois-chiches-boite", qtyPerPerson: 100 };
}

/** Variante végé d'une recette avec viande, complétée d'une protéine si besoin. */
export function vegPart(r: Recipe, allergens: string[] = []): Ingredient[] {
  return r.vegSwap.some((i) => PROTEIN.test(i.itemId)) ? r.vegSwap : [...r.vegSwap, proteinFor(r, allergens)];
}

/** Parts végé d'un créneau : végétariens du foyer (portion adulte), doublées s'il y a des restes ; jamais plus que le créneau. */
export function vegPortions(slot: Slot, settings: Pick<Settings, "vegEaters">, base: number): number {
  const v = Math.max(0, settings.vegEaters || 0);
  if (!v || slot.veg) return 0;
  return Math.min(v * (slot.leftovers ? 2 : 1), slotPortions(slot, base));
}

export interface MealPart { ings: Ingredient[]; portions: number; label: "commun" | "viande" | "vege" }

/** Ce qu'il faut cuisiner pour le plat principal d'un créneau, en parts. */
export function mealParts(r: Recipe, veg: boolean, portions: number, vegP: number, allergens: string[] = []): MealPart[] {
  if (portions <= 0) return [];
  if (isVegRecipe(r) || r.source === "pret") return [{ ings: ingredientsOf(r, false), portions, label: "commun" }]; // plat préparé : tel quel
  if (veg) return [{ ings: [...r.ingredients, ...vegPart(r, allergens)], portions, label: "commun" }]; // tout le repas en végé, avec sa protéine
  if (vegP <= 0) return [{ ings: ingredientsOf(r, false), portions, label: "commun" }];
  const p = Math.min(vegP, portions);
  return [{ ings: r.ingredients, portions, label: "commun" }, { ings: r.meat, portions: portions - p, label: "viande" }, { ings: vegPart(r, allergens), portions: p, label: "vege" }]
    .filter((x) => x.portions > 0 && x.ings.length) as MealPart[];
}
