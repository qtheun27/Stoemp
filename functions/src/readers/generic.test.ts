import { describe, expect, it } from "vitest";
import { parseGeneric } from "./generic";

// Extraits fictifs (prix inventés) aux formats de deux enseignes.
describe("lecteur générique", () => {
  it("prix d'abord (Renmans)", () => {
    const p = parseGeneric(["Nos produits - Viandes - Boeuf", "€ 10,00", "/kg", "Bouilli avec os", "€ 10,00", "/kg", "Bouilli avec os", "€ 20,00", "/kg", "Carbonnade de boeuf", "€ 3,50", "/pce", "Hamburger", "€ 30,00", "/kg", "Entrecôte"].join("\n"));
    expect(p.map((x) => x.name)).toEqual(["Bouilli avec os", "Carbonnade de boeuf", "Hamburger", "Entrecôte"]);
    expect(p[1]).toMatchObject({ price: 20, packSize: 1000, packUnit: "g" });
    expect(p[2]).toMatchObject({ price: 3.5, packSize: 1, packUnit: "pc" });
  });
  it("nom d'abord, avec contenance et prix au kilo", () => {
    const p = parseGeneric(["Ajouter au panier", "Spaghetti", "500 g", "1,00 €", "2,00 €/kg", "Ajouter", "Lait demi-écrémé", "1 l", "0,90 €", "Tomates cerises", "250 g", "2,00 €", "Ajouter"].join("\n"));
    expect(p.map((x) => x.name)).toEqual(["Spaghetti", "Lait demi-écrémé", "Tomates cerises"]);
    expect(p[0]).toMatchObject({ price: 1, packSize: 500, packUnit: "g" });
    expect(p[1]).toMatchObject({ packSize: 1000, packUnit: "ml" });
  });
  it("rien à lire dans un menu", () => {
    expect(parseGeneric("Accueil\nProduits\nPromotions\nNos magasins").length).toBe(0);
  });
});
