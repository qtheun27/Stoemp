import { describe, expect, it } from "vitest";
import { colruytShop, parseColruyt } from "./colruyt";
import { aliasFits, headFits, matchItem, similarItem, similarity } from "./match";
import { tagsOf, tierOf } from "./tiers";

// Extrait fictif au format d'une page Colruyt (prix inventés).
const PAGE = `Produits
403 produits à
Colruyt Exempleville
Pertinence
concombre
0
80
/pce
0,80/pce
BONI bananes
±1kg
1
90
/kg
1,90/kg
Oignons
1
40
/kg
1,40/kg
1
30
/kg
 àpd 40 pcs
1,30/kg
Action
BONI BIO Orange
1.5kg
5
20
/pce
3,47/kg
BONI abricots séchés
200g
2
30
/pce
11,50/kg
BONI mini poivrons
6-8pc
2
20
/kg
2,20/kg
Kaki
0
75
/pce
0,75/pce
Réaction promo concurrent
0
445
/pce
 àpd 4 pcs
0,445/pce
BONI roquette sachet
100g
0
981
/pce
9,81/kg
Bio
BONI BIO menthe plante
1pc
1
30
/pce
1,30/pce`;

const items = [
  { id: "concombre", name: "Concombre", aliases: [], category: "fl", unit: "pc" as const, packSize: 1 },
  { id: "bananes", name: "Bananes", aliases: ["banane"], category: "fl", unit: "g" as const, packSize: 1000 },
  { id: "oignon", name: "Oignon", aliases: ["oignons"], category: "fl", unit: "pc" as const, packSize: 8 },
  { id: "oranges", name: "Oranges", aliases: ["orange"], category: "fl", unit: "g" as const, packSize: 2000 },
  { id: "abricots", name: "Abricots", aliases: [], category: "fl", unit: "g" as const, packSize: 500 },
  { id: "menthe", name: "Menthe", aliases: [], category: "fl", unit: "pc" as const, packSize: 1 },
];

describe("lecteur Colruyt sans IA", () => {
  const P = parseColruyt(PAGE);
  it("lit nom, contenance, prix et promo ; ignore le prix dégressif", () => {
    expect(colruytShop(PAGE)).toBe("Colruyt Exempleville");
    expect(P.map((p) => p.name)).toEqual(["concombre", "BONI bananes", "Oignons", "BONI BIO Orange", "BONI abricots séchés", "BONI mini poivrons", "Kaki", "BONI roquette sachet", "BONI BIO menthe plante"]);
    expect(P[7]).toMatchObject({ packSize: 100, packUnit: "g", price: 0.981 }); // prix à 3 décimales
    expect(P[5]).toMatchObject({ packSize: 1000, packUnit: "g", price: 2.2 }); // « 6-8pc » vendu au kilo
    expect(P[6].promo).toMatch(/concurrent : 0,445 €\/pce àpd 4/);
    expect(P[1]).toMatchObject({ packSize: 1000, packUnit: "g", price: 1.9 });
    expect(P[2].promo).toMatch(/àpd 40/);
    expect(P[3]).toMatchObject({ packSize: 1500, packUnit: "g", price: 5.2, organic: true });
  });
  it("relie au catalogue, convertit pièce ↔ kilo, écarte les dérivés", () => {
    const m = (i: number) => matchItem(P[i].name, P[i].packSize, P[i].packUnit, items as never);
    expect(m(0)?.item.id).toBe("concombre");
    expect(m(1)?.item.id).toBe("bananes");
    expect(m(2)).toMatchObject({ item: { id: "oignon" } });
    expect(m(2)!.size).toBeCloseTo(1000 / 150); // 1 kg ≈ 6,7 oignons
    expect(m(3)?.item.id).toBe("oranges");
    expect(m(4)).toBeNull(); // abricots séchés ≠ abricots
    expect(m(8)).toBeNull(); // menthe en plante ≠ menthe
  });
});

describe("correspondance : le mot principal du produit compte", () => {
  const it2 = (id: string, name: string, aliases: string[] = [], unit = "g", category = "viande") => ({ id, name, aliases, unit, category });
  const cat = [
    it2("filet-de-poulet", "Filet de poulet", ["poulet", "blanc de poulet"]), it2("poivre", "Poivre", ["poivre noir"], "g", "epices"),
    it2("salami", "Salami"), it2("feuilles-de-lasagne", "Feuilles de lasagne", ["lasagnes"], "g", "feculents"),
    it2("pates", "Pâtes", [], "g", "feculents"), it2("pate-de-campagne", "Pâté de campagne", ["pâté"]), it2("saucisson", "Saucisson"),
    it2("salade-verte", "Salade verte", ["laitue", "salade"], "pc", "legumes"), it2("escalope-de-porc", "Escalope de porc"),
  ] as never;
  const m = (name: string, unit: "g" | "pc" = "g") => matchItem(name, 1000, unit, cat)?.item.id ?? null;
  it("ne prend pas un assaisonnement ou une garniture pour le produit", () => {
    expect(m("EXEMPLE salami au poivre")).toBe("salami");
    expect(m("lasagne bolognaise")).toBeNull();
    expect(m("Escalope de dinde panées")).toBeNull();
  });
  it("une partie de la bête n'est pas une autre", () => {
    expect(m("Cuisses de poulet")).toBeNull();
    expect(m("Poulet entier")).toBeNull(); // « poulet » seul est un raccourci pour les recettes
    expect(m("EXEMPLE Filet Poulet Nat.")).toBe("filet-de-poulet");
    expect(headFits("Escal. de porc", "Escalope de porc")).toBe(true); // abréviation
  });
  it("pâté ≠ pâtes, saucisse ≠ saucisson", () => {
    expect(m("EXEMPLE pâté de gibier")).toBe("pate-de-campagne"); // et surtout pas « Pâtes »
    expect(m("EXEMPLE pâtes fraîches")).toBe("pates");
    expect(m("EXEMPLE pâte feuilletée")).toBeNull();
    expect(m("Pâté de campagne")).toBe("pate-de-campagne");
    expect(m("Saucisses de campagne")).toBeNull();
    expect(similarity("Saucisses de campagne", "Saucisson")).toBeLessThan(0.5);
  });
  it("un poisson n'est pas une viande", () => {
    const c2 = [it2("steak-de-boeuf", "Steak de bœuf", ["steak"])] as never;
    expect(matchItem("EXEMPLE steak de thon", 1000, "g", c2)).toBeNull();
    expect(matchItem("steak minute", 1000, "g", c2)?.item.id).toBe("steak-de-boeuf");
  });
  it("synonymes de cuisine", () => {
    expect(similarity("Abricots séchés", "Abricots secs")).toBe(1);
    expect(similarity("Endives", "Chicons")).toBe(1);
  });
  it("un alias propre à l'article reste utilisable", () => {
    expect(m("Laitue iceberg", "pc")).toBe("salade-verte");
  });
  it("n'apprend que des noms qui conviennent", () => {
    expect(aliasFits("Filets de poulet tranchés", "Filet de poulet")).toBe(true);
    expect(aliasFits("Saucisses de poulet", "Filet de poulet")).toBe(false);
    expect(aliasFits("Pizza poulet kebab", "Pizza au chorizo")).toBe(false);
    expect(similarItem("Steaks hachés", "g", "viande", [it2("burger", "Burger croustillant")] as never)).toBeNull();
  });
});

describe("gammes et particularités", () => {
  it("classe les produits par gamme d'après la marque", () => {
    expect(tierOf("colruyt", "EVERYDAY bananes")).toBe("eco");
    expect(tierOf("colruyt", "BONI bananes")).toBe("maison");
    expect(tierOf("colruyt", "BONI BIO Orange")).toBe("maison");
    expect(tierOf("colruyt", "carottes")).toBe("maison");
    expect(tierOf("colruyt", "PAPILLON bananes")).toBe("marque");
    expect(tierOf("delhaize", "365 spaghetti")).toBe("eco");
  });
  it("repère sans gluten, sans lactose, végétal", () => {
    expect(tagsOf("BONI spaghetti sans gluten")).toEqual(["sans-gluten"]);
    expect(tagsOf("ALPRO boisson soja sans lactose vegan")).toEqual(["sans-lactose", "vegetal"]);
    expect(tagsOf("BONI PLAN'T Lentilles")).toEqual(["vegetal"]);
  });
});
