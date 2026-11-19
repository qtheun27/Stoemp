import { describe, expect, it } from "vitest";
import { BASE_INDEX, BASE_RECIPES } from "../catalog";
import { loadLibrary } from "../../../scripts/library/format";
import { mealNeeds } from "../shopping";
import { assignSides, defaultSideLabel, sideOptions, slotRecipe, swappableStarch, withSide } from "../sides";
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

describe("accompagnement proposé d'office", () => {
  it("varie dans la semaine et ne touche pas aux plats dont le féculent est le plat", async () => {
    const { assignSides, defaultSideLabel } = await import("../sides");
    const carbo = byName("Carbonnade flamande"), pasta = byName("Pâtes carbonara");
    const slots = assignSides([{ recipeId: carbo.id }, { recipeId: carbo.id }, { recipeId: pasta.id }] as never[], all, BASE_INDEX, () => 0) as { side?: string }[];
    expect(slots[0].side).toBeTruthy();
    expect(slots[1].side).toBeTruthy();
    expect(slots[0].side).not.toBe(slots[1].side);
    expect(slots[2].side).toBeUndefined();
    expect(defaultSideLabel(carbo, BASE_INDEX)).toBe("pommes de terre");
  });
});

describe("plats renommés sans leur accompagnement", () => {
  it("gardent leur fiche, proposent leur accompagnement d'origine et peuvent en changer", async () => {
    const { loadLibrary } = await import("../../../scripts/library/format");
    const { recipes } = loadLibrary();
    const r = recipes.find((x) => x.name === "Boulettes sauce tomate")!;
    expect(r.id).toBe("lib-boulettes-sauce-tomate-et-puree");
    expect(r.replaces).toBeTruthy();
    const rec = { ...r, source: "base" as const, sideLabel: r.sideLabel };
    expect(defaultSideLabel(rec as never, BASE_INDEX)).toBe("purée");
    expect(recipes.filter((x) => x.course === "plat" && / et (frites|purée|riz)$/.test(x.name))).toEqual([]);
  });
});

describe("étapes qui suivent l'accompagnement choisi", () => {
  const find = (n: string) => lib.find((r) => r.name === n)!;
  it("la purée disparaît des étapes quand on prend des frites", () => {
    const w = withSide(find("Boulettes sauce tomate"), find("Frites belges maison"), BASE_INDEX);
    const plat = w.steps.slice(0, w.steps.indexOf("Accompagnement — Frites belges maison :"));
    expect(plat.some((s) => /pur[ée]e/i.test(s))).toBe(false);
    expect(plat.some((s) => s.includes("l'accompagnement (frites belges maison)"))).toBe(true);
    expect(w.steps).toContain("Accompagnement — Frites belges maison :");
  });
  it("un légume cuit avec le riz reste, sans le riz", () => {
    const side = lib.find((r) => r.course === "accompagnement" && /^Riz/.test(r.name))!;
    const w = withSide(find("Saumon et brocoli"), side, BASE_INDEX);
    expect(w.steps[0]).toMatch(/^Cuire le brocoli/);
  });
  it("retient l'accord du foyer pour ce plat", () => {
    const r = find("Boulettes sauce tomate"), fr = find("Frites belges maison");
    const recipes = new Map(lib.map((x) => [x.id, x]));
    const [sl] = assignSides([{ recipeId: r.id, fromLeftovers: false } as never], recipes, BASE_INDEX, Math.random, { [r.id]: fr.id });
    expect((sl as { side: string }).side).toBe(fr.id);
  });
});
