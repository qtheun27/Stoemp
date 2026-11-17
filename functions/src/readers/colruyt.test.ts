import { describe, expect, it } from "vitest";
import { colruytShop, parseColruyt } from "./colruyt";
import { matchItem } from "./match";
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
    expect(P.map((p) => p.name)).toEqual(["concombre", "BONI bananes", "Oignons", "BONI BIO Orange", "BONI abricots séchés", "BONI mini poivrons", "Kaki", "BONI BIO menthe plante"]);
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
    expect(m(7)).toBeNull(); // menthe en plante ≠ menthe
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
