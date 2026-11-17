import { describe, expect, it } from "vitest";
import { BASE_ITEMS, cookable, ingredientsOf, isVegRecipe, ItemIndex } from "../catalog";
import { isMeatyName, looksReady, packPersons, readyPortion, readyRecipe } from "../ready";
import { mealNeeds } from "../shopping";
import type { Item } from "../types";

const dish = (name: string, unit: Item["unit"] = "g", packSize = 400): Item =>
  ({ ...BASE_ITEMS[0], id: name.toLowerCase().replace(/[^a-z]+/g, "-"), name, unit, packSize, ready: true, source: "ia" });

describe("plats préparés", () => {
  it("reconnaît un plat préparé, pas une base de cuisine", () => {
    expect(looksReady("Lasagne bolognaise")).toBe(true);
    expect(looksReady("Hachis parmentier aux chicons")).toBe(true);
    expect(looksReady("Pizza margherita")).toBe(true);
    expect(looksReady("Pâte à pizza")).toBe(false);
    expect(looksReady("Feuilles de lasagne")).toBe(false);
    expect(looksReady("Sauce spaghetti")).toBe(false);
    expect(looksReady("Couscous perlé")).toBe(false);
  });
  it("portion : 350 g, ou la part indiquée sur l'emballage", () => {
    expect(packPersons("Repas wraps kebab pour 4 personnes")).toBe(4);
    expect(packPersons("Plat mexicain 2pers.")).toBe(2);
    expect(readyPortion(dish("Lasagne bolognaise"))).toBe(350);
    expect(readyPortion(dish("Plat mexicain pour 2 personnes", "g", 1100))).toBe(550);
    expect(readyPortion(dish("Repas pita 4p", "pc", 1))).toBe(0.25);
  });
  it("viande ou végé d'après le nom", () => {
    expect(isMeatyName("Lasagne au saumon")).toBe(true);
    expect(isMeatyName("Quiche lorraine")).toBe(true);
    expect(isMeatyName("Lasagne ricotta épinards")).toBe(false);
    const r = readyRecipe(dish("Lasagne bolognaise"));
    expect(isVegRecipe(r)).toBe(false);
    expect(ingredientsOf(r, true)).toHaveLength(1); // pas de version végé à inventer : c'est le même plat
    expect(isVegRecipe(readyRecipe(dish("Pizza margherita")))).toBe(true);
  });
  it("va dans la liste de courses mais pas dans le planificateur", () => {
    const it = dish("Lasagne bolognaise");
    const idx = new ItemIndex([...BASE_ITEMS, it]);
    const r = readyRecipe(it);
    const need = mealNeeds([{ day: 0, meal: "soir", recipeId: r.id, veg: false, cooked: false }], new Map([[r.id, r]]), 3, idx);
    expect(need.get(it.id)).toBe(1050); // 3 portions × 350 g
    expect(cookable([r])).toHaveLength(0);
  });
});
