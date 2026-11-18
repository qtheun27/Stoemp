import { describe, expect, it } from "vitest";
import { BASE_INDEX, BASE_RECIPES, isVegRecipe } from "../catalog";
import { CUISINE_ORDER } from "../constants";
import { DEFAULT_SETTINGS } from "../defaults";
import { score, type PlanCtx } from "../planner";

describe("base de recettes", () => {
  it("plus de 180 recettes, toutes classées par cuisine, sans doublon", () => {
    expect(BASE_RECIPES.length).toBeGreaterThanOrEqual(180);
    expect(BASE_RECIPES.every((r) => r.cuisine && CUISINE_ORDER.includes(r.cuisine))).toBe(true);
    expect(new Set(BASE_RECIPES.map((r) => r.id)).size).toBe(BASE_RECIPES.length);
    for (const c of CUISINE_ORDER) expect(BASE_RECIPES.filter((r) => r.cuisine === c).length).toBeGreaterThanOrEqual(8);
  });
  it("chaque plat avec viande a une variante végé nommée", () => {
    const bad = BASE_RECIPES.filter((r) => !isVegRecipe(r) && (!r.vegSwap.length || !r.vegName)).map((r) => r.name);
    expect(bad).toEqual([]);
  });
  it("les cuisines préférées reviennent plus souvent", () => {
    const it = BASE_RECIPES.find((r) => r.cuisine === "indienne")!;
    const ctx = (cuisines: string[]) => ({ settings: { ...DEFAULT_SETTINGS, options: { ...DEFAULT_SETTINGS.options, promos: false, useStock: false, local: false, cuisines } }, favorites: [], stock: new Map(), idx: BASE_INDEX, now: new Date(), book: undefined as never } as unknown as PlanCtx);
    expect(score(it, ctx(["indienne"]))).toBeGreaterThan(score(it, ctx([])));
    expect(score(it, ctx(["belge"]))).toBeLessThan(score(it, ctx([])));
  });
});

describe("grande bibliothèque", () => {
  it("fiche compacte → recette sans étapes, entrée et dessert hors du planificateur", async () => {
    const { libRecipe, mains } = await import("../catalog");
    const r = libRecipe({ i: "lib-x", n: "Velouté test", v: null, t: 20, s: "AH", c: "francaise", k: "entree", g: [["carottes", 150]], m: [], w: [] });
    expect(r).toMatchObject({ id: "lib-x", lib: true, course: "entree", seasons: ["A", "H"], steps: [] });
    expect(r.ingredients).toEqual([{ itemId: "carottes", qtyPerPerson: 150 }]);
    const plat = libRecipe({ i: "lib-y", n: "Plat test", v: null, t: 30, s: "PEAH", c: "belge", g: [["carottes", 100]], m: [], w: [] });
    expect(mains([r, plat]).map((x) => x.id)).toEqual(["lib-y"]);
  });
});

describe("repas complets", () => {
  it("chaque plat principal de base a son féculent, sauf repas léger ou déjà complet déclaré", async () => {
    const { hasStarch } = await import("../balance");
    const { BASE_INDEX: idx } = await import("../catalog");
    expect(BASE_RECIPES.filter((r) => (r.course || "plat") === "plat" && !r.light && !hasStarch(r, idx)).map((r) => r.name)).toEqual([]);
    // Un repas léger déclaré ne reçoit pas de féculent ajouté (le cuisinier a tranché).
    expect(BASE_RECIPES.filter((r) => r.light && hasStarch(r, idx)).map((r) => r.name)).toEqual([]);
  });
});
