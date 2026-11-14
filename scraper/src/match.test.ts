import { describe, expect, it } from "vitest";
import { choose, score } from "./match.js";
import { parsePack, perKilo } from "./parse.js";
import { productsFromJson } from "./browser.js";

const lait = { id: "lait", name: "Lait", aliases: ["lait demi-écrémé"], category: "fr", unit: "ml" as const, packSize: 1000 };

describe("robot de prix", () => {
  it("lit les contenances et prix au kilo", () => {
    expect(parsePack("Boni lait demi-écrémé 6 x 1 l")).toEqual({ size: 6000, unit: "ml" });
    expect(parsePack("Pâtes 500 g")).toEqual({ size: 500, unit: "g" });
    expect(parsePack("Papier toilette 12 rouleaux")).toEqual({ size: 12, unit: "pc" });
    expect(perKilo("AILES DE POULET € 4,98/kg")).toEqual({ price: 4.98, unit: "g" });
  });
  it("écarte les dérivés et choisit le prix au litre le plus bas", () => {
    const P = [
      { name: "Lait de coco 400 ml", price: 1.5, packSize: 400, packUnit: "ml" as const, organic: false },
      { name: "Boni lait demi-écrémé 1 l", price: 1.05, packSize: 1000, packUnit: "ml" as const, organic: false, brand: "Boni" },
      { name: "Lait demi-écrémé 6 x 1 l", price: 5.7, packSize: 6000, packUnit: "ml" as const, organic: false },
      { name: "Chips saveur lait", price: 1, packSize: 1000, packUnit: "ml" as const, organic: false },
    ];
    expect(score(lait, P[3])).toBeLessThan(0.5);
    const c = choose(lait, "colruyt", P);
    expect(c.kind === "ok" && c.product.name).toBe("Lait demi-écrémé 6 x 1 l");
  });
  it("trouve des produits dans un JSON d'enseigne quelconque", () => {
    const json = { data: { products: [{ id: "1", LongName: "Boni pâtes fusilli", content: "500 g", price: { basicPrice: 0.99 } }] } };
    const r = productsFromJson(json, "https://x");
    expect(r[0]).toMatchObject({ name: "Boni pâtes fusilli", price: 0.99, packSize: 500, packUnit: "g" });
  });
});
