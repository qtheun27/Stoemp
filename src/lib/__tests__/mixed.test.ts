import { describe, expect, it } from "vitest";
import { BASE_INDEX, BASE_RECIPES } from "../catalog";
import { mealParts, proteinFor, vegPart, vegPortions } from "../mixed";
import { mealNeeds } from "../shopping";
import type { Slot } from "../types";

const bolo = BASE_RECIPES.find((r) => r.name === "Lasagnes bolognaise")!;
const slot = (p: Partial<Slot> = {}): Slot => ({ day: 0, meal: "soir", recipeId: bolo.id, veg: false, cooked: false, ...p });

describe("foyer mixte", () => {
  it("parts végé : végétariens du foyer, doublées avec les restes, jamais plus que le repas", () => {
    expect(vegPortions(slot(), { vegEaters: 1 }, 3)).toBe(1);
    expect(vegPortions(slot({ leftovers: true }), { vegEaters: 1 }, 3)).toBe(2);
    expect(vegPortions(slot({ veg: true }), { vegEaters: 1 }, 3)).toBe(0); // repas déjà tout végé
    expect(vegPortions(slot(), { vegEaters: 5 }, 2)).toBe(2);
  });
  it("un seul plat : base commune pour tous, viande pour les uns, protéine végé pour les autres", () => {
    const parts = mealParts(bolo, false, 3, 1);
    expect(parts.map((p) => [p.label, p.portions])).toEqual([["commun", 3], ["viande", 2], ["vege", 1]]);
    expect(parts[2].ings.some((i) => i.itemId === "lentilles-corail")).toBe(true); // butternut seul ne nourrit pas : lentilles ajoutées
  });
  it("protéine adaptée au plat, et sans œufs si allergie", () => {
    const soup = { ...bolo, name: "Velouté et croque-monsieur" };
    expect(proteinFor(soup).itemId).toBe("oeufs");
    expect(proteinFor(soup, ["oe"]).itemId).toBe("pois-chiches-boite");
    const withProtein = BASE_RECIPES.find((r) => r.vegSwap.some((i) => /lentil|pois-chiches|tofu/.test(i.itemId)))!;
    expect(vegPart(withProtein)).toEqual(withProtein.vegSwap); // déjà une protéine : rien d'ajouté
  });
  it("liste de courses : viande pour 2, lentilles pour 1", () => {
    const recipes = new Map([[bolo.id, bolo]]);
    const mixed = mealNeeds([slot()], recipes, 3, BASE_INDEX, 1);
    const meat = bolo.meat[0];
    expect(mixed.get(meat.itemId)).toBeCloseTo(meat.qtyPerPerson * 2);
    expect(mixed.get("lentilles-corail")).toBeCloseTo(40);
    const all = mealNeeds([slot()], recipes, 3, BASE_INDEX, 0);
    expect(all.get(meat.itemId)).toBeCloseTo(meat.qtyPerPerson * 3);
    expect(all.has("lentilles-corail")).toBe(false);
  });
});
