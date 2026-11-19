import { describe, expect, it } from "vitest";
import { BASE_INDEX, BASE_RECIPES } from "../catalog";
import { loadLibrary } from "../../../scripts/library/format";
import { mealNeeds } from "../shopping";
import { sideOptions, slotRecipe, swappableStarch, withSide } from "../sides";
import type { Recipe } from "../types";

const lib = loadLibrary().recipes.map((r) => ({ ...r, source: "base" as const, lib: true })) as unknown as Recipe[];
const all = new Map([...BASE_RECIPES, ...lib].map((r) => [r.id, r]));
const byName = (n: string) => [...all.values()].find((r) => r.name === n)!;

describe("accompagnement au choix", () => {
  const carbo = byName("Carbonnade flamande"), frites = byName("Frites belges maison"), puree = byName("Purée de pommes de terre maison");
  it("propose des accompagnements de la même famille, pas pour un plat dont le féculent est le plat", () => {
    const opts = sideOptions(carbo, all.values(), BASE_INDEX).map((r) => r.name);
    expect(opts).toContain("Frites belges maison");
    expect(opts).toContain("Purée de pommes de terre maison");
    expect(opts).not.toContain("Riz pilaf");
    expect(swappableStarch(byName("Pâtes carbonara"), BASE_INDEX)).toBeNull();
  });
  it("remplace le féculent d'origine et ajoute les étapes de l'accompagnement", () => {
    const r = withSide(carbo, puree, BASE_INDEX);
    expect(r.ingredients.filter((i) => i.itemId === "pommes-de-terre").length).toBe(1); // celles de la purée, pas les deux
    expect(r.ingredients.some((i) => i.itemId === "lait")).toBe(true);
    expect(r.steps.some((s) => s.includes("Purée de pommes de terre maison"))).toBe(true);
  });
  it("les courses suivent l'accompagnement choisi", () => {
    const withFries = mealNeeds([{ day: 0, meal: "soir", recipeId: carbo.id, veg: false, cooked: false, side: frites.id }], all, 2, BASE_INDEX);
    expect(withFries.get("huile-de-tournesol")).toBeGreaterThan(0);
    const plain = mealNeeds([{ day: 0, meal: "soir", recipeId: carbo.id, veg: false, cooked: false }], all, 2, BASE_INDEX);
    expect(plain.get("huile-de-tournesol") || 0).toBe(0);
    expect(slotRecipe(all, { recipeId: carbo.id, side: frites.id }, BASE_INDEX)!.sideName).toBe("Frites belges maison");
  });
});
