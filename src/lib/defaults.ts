import type { GenOptions, Settings } from "./types";

export const DEFAULT_OPTIONS: GenOptions = {
  seasonal: true, season: "auto", local: false, organic: false, veg: false,
  budgetOn: false, budget: 80, timeOn: false, maxTime: 30,
  allergens: [], avoid: [], favorites: true, ai: false, useStock: true, range: "maison",
};

export const DEFAULT_SETTINGS: Settings = {
  persons: 2, mealsPerDay: 1, mineN: 2, options: DEFAULT_OPTIONS,
  stores: ["colruyt", "renmans"], preferredStore: "cheapest",
  myColruytStore: "", renmansShop: "", shoppingDays: [6],
};
