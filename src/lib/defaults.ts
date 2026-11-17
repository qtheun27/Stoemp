import type { GenOptions, Settings } from "./types";

export const DEFAULT_OPTIONS: GenOptions = {
  seasonal: true, season: "auto", local: false, organic: false, veg: false,
  budgetOn: false, budget: 80, timeOn: false, maxTime: 30,
  allergens: [], avoid: [], favorites: true, ai: false, useStock: true, range: "maison",
  kidFriendly: true, drinks: true, noAlcohol: false, promos: true, balance: true,
};

export const DEFAULT_SETTINGS: Settings = {
  persons: 2, adults: 2, teens: 0, kids: 0, lunches: 0, dinners: 7, mineN: 2, options: DEFAULT_OPTIONS,
  stores: ["colruyt", "renmans"], preferredStore: "cheapest",
  shops: {}, shoppingDays: [6],
};
