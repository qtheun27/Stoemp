import { describe, expect, it } from "vitest";
import { isBabyFood, isNonFood, isNonFoodPage } from "./nonfood";

describe("produits non alimentaires", () => {
  it("animaux, entretien, hygiène et beauté sont reconnus", () => {
    for (const n of ["PEDIGREE Pâtée pour chien au bœuf", "WHISKAS Bouchées au poulet pour chat", "Friandises pour chiens saveur poulet", "COLRUYT Litière pour chat",
      "DOVE Gel douche crème", "NIVEA Crème pour le corps", "Lait corporel amande", "Shampooing pommes", "Lessive liquide lavande", "Nettoyant sols citron", "Liquide vaisselle citron vert", "Savon au lait de chèvre",
      "FROLIC boeuf frais", "EVERYDAY crème à récurer citron", "ERES vinaigre nettoy. 14° spray", "SHEBA mini filets poulet-dinde barq", "WHISKAS Catmilk"])
      expect(isNonFood(n), n).toBe(true);
  });
  it("la nourriture reste de la nourriture", () => {
    for (const n of ["Haché de bœuf", "Filet de poulet", "Crème fraîche épaisse", "Lait demi-écrémé", "Châtaignes cuites", "Côtes de porc", "Chips saveur poulet", "Croquettes de crevettes",
      "Lapin entier", "Pain de mie", "Huile d'olive", "Lait de coco", "Poisson pané", "Gourmet chocolat noir",
      "Oiseaux sans tête", "Oiseau sans tete", "langues d'oiseau", "Sauce César", "Persil frais", "Vinaigre de vin"])
      expect(isNonFood(n), n).toBe(false);
  });
  it("petits pots pour bébé à part", () => {
    expect(isBabyFood("OLVARIT Pâtes Veau +12m")).toBe(true);
    expect(isBabyFood("BONI Pates Legumes Poulet Bio +15M")).toBe(true);
    expect(isBabyFood("Pâtes Penne")).toBe(false);
  });
  it("adresse d'un rayon non alimentaire", () => {
    expect(isNonFoodPage("https://www.colruyt.be/fr/produits/animaux/chats")).toBe(true);
    expect(isNonFoodPage("https://www.colruyt.be/fr/produits/viande/boeuf")).toBe(false);
  });
});
