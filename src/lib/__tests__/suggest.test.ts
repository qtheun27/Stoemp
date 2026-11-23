import { describe, expect, it } from "vitest";
import { ItemIndex } from "../catalog";
import type { Item } from "../types";

const item = (name: string, aliases: string[] = []): Item => ({
  id: name.toLowerCase().replace(/\W+/g, "-"), name, aliases, category: "fr", unit: "g", packSize: 1, demoPrice: 0, local: false,
  organicAvailable: false, perishable: false, staple: false, common: false, shelfLifeDays: 7, allergens: [], seasonMonths: [], source: "base",
});

describe("articles proches d'une ligne de ticket", () => {
  const idx = new ItemIndex([item("Escalope végétale"), item("Wiener Schnitzel de porc"), item("Coton-tiges"), item("Lait demi-écrémé")]);
  it("propose les articles qui partagent un mot ou son début", () => {
    expect(idx.suggest("Coton tige").map((i) => i.name)).toEqual(["Coton-tiges"]);
    expect(idx.suggest("Schnitzel végé").map((i) => i.name)).toEqual(expect.arrayContaining(["Escalope végétale", "Wiener Schnitzel de porc"]));
  });
  it("ne propose rien sans mot commun", () => expect(idx.suggest("Chocolat noir")).toEqual([]));
});
