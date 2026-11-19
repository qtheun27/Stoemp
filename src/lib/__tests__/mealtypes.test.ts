import { describe, expect, it } from "vitest";
import { BASE_INDEX, BASE_RECIPES } from "../catalog";
import { DEFAULT_SETTINGS } from "../defaults";
import { emptyBook } from "../pricing";
import { isLightMeal, planWeek, poolFor, weekFrame } from "../planner";
import type { Recipe } from "../types";

const settings = { ...DEFAULT_SETTINGS, lunchDays: [0, 2], dinnerDays: [0, 1, 2, 3, 4], breakfastDays: [5, 6], lightSlots: ["2-midi", "4-soir"],
  options: { ...DEFAULT_SETTINGS.options, seasonal: false, ai: false } };
const ctx = { idx: BASE_INDEX, settings, favorites: [], stock: new Map(), now: new Date(2026, 10, 14), rand: Math.random,
  cost: { idx: BASE_INDEX, book: emptyBook(), stores: settings.stores, pref: "cheapest" as const, organic: false } };
// Quelques déjeuners et soupes fictifs, en plus des plats de base.
const extra: Recipe[] = [0, 1, 2].flatMap((i) => [
  { ...BASE_RECIPES[i], id: `pd-${i}`, name: `Pancakes ${i}`, course: "petitdej" as const },
  { ...BASE_RECIPES[i + 3], id: `sp-${i}`, name: `Velouté ${i}`, course: "soupe" as const },
]);

describe("types de repas", () => {
  it("cadre de la semaine : déjeuner, midi, soir, repas légers", () => {
    const f = weekFrame(settings);
    expect(f.filter((x) => x.meal === "matin").map((x) => x.day)).toEqual([5, 6]);
    expect(f.filter((x) => x.light).map((x) => `${x.day}-${x.meal}`)).toEqual(["2-midi", "4-soir"]);
    expect(f.length).toBe(2 + 2 + 5);
  });
  it("le planificateur met un déjeuner le matin, un repas léger où il est demandé", () => {
    const all = [...BASE_RECIPES, ...extra];
    const w = planWeek(BASE_RECIPES, ctx, [], all);
    const get = (id: string) => all.find((r) => r.id === id)!;
    expect(w.slots.length).toBe(9);
    for (const sl of w.slots) {
      const r = get(sl.recipeId);
      if (sl.meal === "matin") expect(r.course).toBe("petitdej");
      else if (sl.light) expect(isLightMeal(r)).toBe(true);
      else expect(r.course || "plat").toBe("plat");
    }
    expect(new Set(w.slots.map((s) => s.recipeId)).size).toBe(9);
  });
  it("repas léger : soupes et plats de type salade-repas, pas un bourguignon", () => {
    const light = poolFor({ meal: "midi", light: true }, [...BASE_RECIPES, ...extra]);
    expect(light.some((r) => r.course === "soupe")).toBe(true);
    expect(light.some((r) => /salade/i.test(r.name))).toBe(true);
    expect(light.some((r) => /bourguignon|carbonnade|mac and cheese|arancini/i.test(r.name))).toBe(false);
    expect(light.some((r) => /^croque/i.test(r.name))).toBe(true);
  });
});
