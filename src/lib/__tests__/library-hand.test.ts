import { describe, expect, it } from "vitest";
import { loadLibrary, parseLibrary } from "../../../scripts/library/format";

describe("recettes écrites à la main (scripts/library)", () => {
  it("sont toutes valides : articles du catalogue, féculent des plats, version végé, sans doublon", () => {
    const { recipes, errors } = loadLibrary();
    expect(errors).toEqual([]);
    expect(recipes.length).toBeGreaterThan(0);
  });
  it("refuse une unité fausse, un article inconnu et un plat sans féculent", () => {
    const { recipes, errors } = parseLibrary("@belge\n## plat\n# Essai | 4 | 30 | T\n+ Oignon 300g; Truc 1pc; Carottes 500g; Beurre 20g\n- a\n- b\n", "t");
    expect(errors.join()).toMatch(/pc, pas en g/);
    expect(errors.join()).toMatch(/inconnu/);
    expect(recipes[0].ingredients.find((i) => i.itemId === "carottes")?.qtyPerPerson).toBe(125);
  });
});
