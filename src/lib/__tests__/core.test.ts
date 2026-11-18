import { describe, expect, it } from "vitest";
import { BASE_INDEX, BASE_ITEMS, BASE_RECIPES } from "../catalog";
import { bestPair, mealCostPerPerson, storeTotals } from "../cost";
import { DEFAULT_SETTINGS } from "../defaults";
import { parseLine } from "../parse";
import { planWeek } from "../planner";
import { predict, shouldAutoAdd } from "../predict";
import { emptyBook, pickOffer, priceAt } from "../pricing";
import { addDays, isoWeek, nextShoppingDate, ymd } from "../season";
import { buildShopping, mealNeeds } from "../shopping";
import type { ConsumptionEvent, Recipe, Slot, StockEntry } from "../types";
import { fmtQty, packsFor } from "../units";
import { eur } from "../text";

const recipes = new Map(BASE_RECIPES.map((r) => [r.id, r]));
const ctxCost = { idx: BASE_INDEX, book: emptyBook(), stores: DEFAULT_SETTINGS.stores, pref: "cheapest" as const, organic: false };

describe("données de départ", () => {
  it("≈ 280 articles, plus de 180 recettes reliées au catalogue", () => {
    expect(BASE_ITEMS.length).toBeGreaterThanOrEqual(240);
    expect(BASE_RECIPES.length).toBeGreaterThanOrEqual(180);
    for (const r of BASE_RECIPES) for (const i of [...r.ingredients, ...r.meat, ...r.vegSwap]) expect(BASE_INDEX.get(i.itemId)).toBeTruthy();
    expect(new Set(BASE_ITEMS.map((i) => i.id)).size).toBe(BASE_ITEMS.length);
  });
  it("le nom interdit n'apparaît nulle part", () => {
    expect(JSON.stringify(BASE_ITEMS) + JSON.stringify(BASE_RECIPES)).not.toMatch(/ceph/i);
  });
});

describe("quantités", () => {
  it("parse le texte libre", () => {
    expect(parseLine("2 l de lait")).toEqual({ name: "Lait", qty: 2000, unit: "ml" });
    expect(parseLine("400 g de pâtes")).toEqual({ name: "Pâtes", qty: 400, unit: "g" });
    expect(parseLine("lait 1,5l")).toEqual({ name: "Lait", qty: 1500, unit: "ml" });
    expect(parseLine("3 citrons")).toEqual({ name: "Citrons", qty: 3, unit: "pc" });
    expect(parseLine("papier toilette")).toEqual({ name: "Papier toilette", qty: 0, unit: "" });
  });
  it("retrouve les articles par alias et pluriel", () => {
    expect(BASE_INDEX.find("Citrons")?.id).toBe("citron");
    expect(BASE_INDEX.find("pq")?.id).toBe("papier-toilette");
    expect(BASE_INDEX.find("2 paquets de chicons")?.id).toBe("chicons");
  });
  it("formate et arrondit aux paquets", () => {
    expect(fmtQty(1234, "g")).toBe("1,2 kg");
    expect(fmtQty(2.5, "pc")).toBe("× 2½");
    expect(packsFor(1200, 1000)).toBe(2);
    expect(packsFor(1000, 1000)).toBe(1);
    expect(eur(2.49)).toBe("2,49 €");
  });
  it("multiplie les quantités par le nombre de personnes", () => {
    const r = recipes.get("base-pates-carbonara")!;
    const need = mealNeeds([{ day: 0, meal: "soir", recipeId: r.id, veg: false, cooked: false }], recipes, 3, BASE_INDEX);
    expect(need.get("pates")).toBe(270);
    expect(need.get("lardons")).toBe(180);
    const veg = mealNeeds([{ day: 0, meal: "soir", recipeId: r.id, veg: true, cooked: false }], recipes, 3, BASE_INDEX);
    expect(veg.get("lardons")).toBeUndefined();
    expect(veg.get("champignons-de-paris")).toBe(300);
  });
});

describe("liste de courses", () => {
  const slots: Slot[] = [
    { day: 0, meal: "soir", recipeId: "base-pates-carbonara", veg: false, cooked: false },
    { day: 1, meal: "soir", recipeId: "base-spaghetti-bolognaise", veg: false, cooked: true },
  ];
  const base = { slots, recipes, persons: 2, idx: BASE_INDEX, consumption: new Map(), docs: [], nextShopping: addDays(new Date(), 7) };
  it("besoins − stock, arrondi au format, repas cuisinés ignorés", () => {
    const stock = new Map<string, StockEntry>([["oeufs", { qty: 12, unit: "pc", location: "frigo", updatedAt: 0 }]]);
    const { lines } = buildShopping({ ...base, stock });
    const byId = Object.fromEntries(lines.map((l) => [l.itemId, l]));
    expect(byId["oeufs"]).toBeUndefined();
    expect(byId["pates"].qty).toBe(1000);
    expect(byId["pates"].reason).toBe("repas");
    expect(byId["spaghetti"]).toBeUndefined();
  });
  it("ajoute les ruptures prévues et les ajouts manuels, respecte les retraits", () => {
    const events: ConsumptionEvent[] = [0, 7, 14, 21].map((d) => ({ date: ymd(addDays(new Date(), d - 28)), qty: 1000, type: "achat" }));
    const stock = new Map<string, StockEntry>([["lait", { qty: 200, unit: "ml", location: "frigo", updatedAt: 0 }]]);
    const consumption = new Map([["lait", { events, dailyRate: 0, rateConfidence: "aucune" as const, nextRunOut: null }]]);
    const docs = [
      { id: "m1", name: "Piles", qty: 0, unit: "" as const, reason: "manuel" as const, category: "dr" as const, checked: false, addedAt: 0 },
      { id: "auto_pates", name: "Pâtes", qty: 0, unit: "g" as const, reason: "repas" as const, category: "ep" as const, checked: false, removed: true, addedAt: 0 },
    ];
    const { lines } = buildShopping({ ...base, stock, consumption, docs });
    expect(lines.find((l) => l.itemId === "lait")?.reason).toBe("stock");
    expect(lines.find((l) => l.name === "Piles")?.reason).toBe("manuel");
    expect(lines.find((l) => l.itemId === "pates")).toBeUndefined();
  });
});

describe("prédiction", () => {
  const now = new Date(2026, 10, 14);
  const buys = (days: number[], qty = 1000): ConsumptionEvent[] => days.map((d) => ({ date: ymd(addDays(now, d)), qty, type: "achat" }));
  it("rythme pondéré : les intervalles récents pèsent plus", () => {
    const p = predict(buys([-40, -30, -20, -14, -8]), 1000, 1, now);
    // intervalles 10,10,6,6 pondérés 1..4 → 7,2 j ; 1000 / 7,2 ≈ 139 ml/j
    expect(p.dailyRate).toBeCloseTo(1000 / 7.2, 1);
    expect(p.confidence).toBe("haute");
    expect(ymd(p.nextRunOut!)).toBe(ymd(addDays(now, 7)));
  });
  it("moins de 3 achats : suggestion seulement", () => {
    const p = predict(buys([-14, -7]), 0, 1, now);
    expect(shouldAutoAdd(p, addDays(now, 3))).toBe("suggest");
    const p3 = predict(buys([-21, -14, -7]), 0, 1, now);
    expect(shouldAutoAdd(p3, addDays(now, 3))).toBe("auto");
  });
  it("les corrections utilisateur ajustent le rythme", () => {
    const a = predict(buys([-21, -14, -7]), 1000, 1, now);
    const b = predict(buys([-21, -14, -7]), 1000, 1.25, now);
    expect(b.dailyRate).toBeCloseTo(a.dailyRate * 1.25);
  });
  it("prochain jour de courses", () => {
    const sat = nextShoppingDate([6], new Date(2026, 10, 14)); // samedi → samedi suivant
    expect(sat.getDate()).toBe(21);
    expect(isoWeek(new Date(2026, 10, 14))).toBe("2026-W46");
  });
});

describe("coûts", () => {
  it("prix estimé, prix payé prioritaire s'il est plus récent", () => {
    const item = BASE_INDEX.get("lait")!;
    const book = emptyBook();
    expect(priceAt(item, "colruyt", book)?.packPrice).toBe(1.05);
    book.shared.set("lait_colruyt", { itemId: "lait", store: "colruyt", organic: false, productName: "Lait", packSize: 1000, packUnit: "ml", packPrice: 1.1, pricePerUnit: 0.0011, fetchedAt: "2026-11-01T00:00:00Z", source: "robot" });
    expect(priceAt(item, "colruyt", book)?.packPrice).toBe(1.1);
    book.paid.set("lait_colruyt", { itemId: "lait", store: "colruyt", packPrice: 0.99, packSize: 1000, pricePerUnit: 0.00099, date: "2026-11-10" });
    expect(priceAt(item, "colruyt", book)?.source).toBe("payé");
    expect(priceAt(item, "renmans", book)).toBeNull();
  });
  it("coût par personne et meilleure paire de magasins", () => {
    const c = mealCostPerPerson(recipes.get("base-pates-carbonara")!, false, ctxCost);
    expect(c).toBeGreaterThan(0.3);
    expect(c).toBeLessThan(3);
    const lines = [{ itemId: "lardons", qty: 200, unit: "g" as const }, { itemId: "pates", qty: 1000, unit: "g" as const }];
    const totals = storeTotals(lines, ["colruyt", "renmans", "delhaize"], ctxCost);
    expect(totals.find((t) => t.store === "renmans")!.missing).toContain("pates");
    const pair = bestPair(lines, ["colruyt", "renmans", "delhaize"], ctxCost)!;
    expect(pair.missing).toBe(0);
    expect(pair.stores).toContain("colruyt");
  });
});

describe("planificateur", () => {
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ctx = (opts: Partial<typeof DEFAULT_SETTINGS.options> = {}, s: Partial<typeof DEFAULT_SETTINGS> = {}) => ({
    idx: BASE_INDEX, settings: { ...DEFAULT_SETTINGS, ...s, options: { ...DEFAULT_SETTINGS.options, ...opts } },
    favorites: [], stock: new Map(), cost: ctxCost, now: new Date(2026, 10, 14), rand,
  });
  it("7 ou 14 repas, sans doublon quand c'est possible", () => {
    const w = planWeek(BASE_RECIPES, ctx({ seasonal: false }, { lunches: 7, dinners: 7 }));
    expect(w.slots.length).toBe(14);
    expect(new Set(w.slots.map((s) => s.recipeId)).size).toBe(14);
  });
  it("respecte saison, temps, allergies, végétarien et ingrédients à éviter", () => {
    const w = planWeek(BASE_RECIPES, ctx({ timeOn: true, maxTime: 30, allergens: ["gl"], veg: true, avoid: ["champignon"] }));
    for (const s of w.slots) {
      const r = recipes.get(s.recipeId) as Recipe;
      expect(r.prepMin).toBeLessThanOrEqual(30);
      expect(r.seasons).toContain("A");
      expect(r.meat.length === 0 || s.veg).toBe(true);
    }
  });
  it("tient le budget quand c'est possible", () => {
    const w = planWeek(BASE_RECIPES, ctx({ seasonal: false, budgetOn: true, budget: 25 }));
    expect(w.costPerPersonWeek * 2).toBeLessThanOrEqual(25 + 0.01);
  });
});

describe("variantes de prix selon le foyer", () => {
  const pates = BASE_INDEX.get("pates")!; // contient du gluten
  const o = (name: string, tier: "eco" | "maison" | "marque", ppu: number, extra: Partial<{ organic: boolean; tags: string[] }> = {}) =>
    ({ name, tier, organic: false, tags: [], size: 1000, price: ppu * 1000, ppu, ...extra });
  const offers = [o("EVERYDAY pâtes", "eco", 0.0008), o("BONI pâtes", "maison", 0.0012), o("BARILLA pâtes", "marque", 0.0025),
    o("BONI BIO pâtes", "maison", 0.002, { organic: true }), o("BONI pâtes sans gluten", "maison", 0.006, { tags: ["sans-gluten"] })];
  const sel = (x: object = {}) => ({ organic: false, range: "maison" as const, allergens: [], ...x });
  it("gamme : premier prix, marque du magasin, grandes marques", () => {
    expect(pickOffer(pates, offers, sel({ range: "eco" }))?.name).toBe("EVERYDAY pâtes");
    expect(pickOffer(pates, offers, sel())?.name).toBe("BONI pâtes");
    expect(pickOffer(pates, offers, sel({ range: "marque" }))?.name).toBe("BARILLA pâtes");
  });
  it("bio et allergies priment sur la gamme", () => {
    expect(pickOffer(pates, offers, sel({ organic: true }))?.name).toBe("BONI BIO pâtes");
    expect(pickOffer(pates, offers, sel({ allergens: ["gl"] }))?.name).toBe("BONI pâtes sans gluten");
    // Un article sans gluten n'est pas concerné par l'allergie au gluten.
    expect(pickOffer(BASE_INDEX.get("lait")!, [o("BONI lait", "maison", 0.001)], sel({ allergens: ["gl"] }))?.name).toBe("BONI lait");
  });
  it("le budget suit la variante choisie", () => {
    const book = emptyBook();
    book.shared.set("pates_colruyt", { itemId: "pates", store: "colruyt", organic: false, productName: "EVERYDAY pâtes", packSize: 1000, packUnit: "g", packPrice: 0.8, pricePerUnit: 0.0008, fetchedAt: "2026-11-17T00:00:00Z", source: "capture", offers });
    expect(priceAt(pates, "colruyt", book, sel({ range: "eco" }))?.packPrice).toBeCloseTo(0.8);
    expect(priceAt(pates, "colruyt", book, sel())?.packPrice).toBeCloseTo(1.2);
    expect(priceAt(pates, "colruyt", book, sel({ allergens: ["gl"] }))?.packPrice).toBeCloseTo(6);
  });
});

import { findDuplicates, similarity } from "../similar";
describe("doublons du catalogue", () => {
  const it0 = (id: string, name: string, source: "base" | "ia", extra: object = {}) => ({ ...BASE_INDEX.get("pates")!, id, name, aliases: [], unit: "g" as const, category: "ep" as const, source, ...extra });
  it("repère les noms très proches", () => {
    expect(similarity("Cacahuètes apéritif", "Cacahuètes et noix apéritives")).toBeGreaterThanOrEqual(0.75);
    expect(similarity("Abricots secs", "Abricots")).toBeGreaterThanOrEqual(0.75);
    expect(similarity("Framboises", "Fraises")).toBeLessThan(0.5);
  });
  it("propose de fusionner vers l'article de base ou le nom le plus court", () => {
    const d = findDuplicates([it0("a", "Mélange de fruits secs et noix", "ia"), it0("b", "Mélange de fruits secs", "ia"), it0("c", "Riz", "base"), it0("d", "Riz long", "ia")]);
    expect(d.map((x) => `${x.from.id}→${x.into.id}`)).toEqual(expect.arrayContaining(["a→b", "d→c"]));
  });
});

import { mealCounts, spreadDays } from "../planner";
describe("nombre de repas", () => {
  it("répartit midis et soirs choisis séparément", () => {
    expect(spreadDays(7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(spreadDays(2)).toEqual([1, 5]);
    expect(mealCounts({ lunches: 3, dinners: 5 })).toEqual({ lunches: 3, dinners: 5, total: 8 });
    expect(mealCounts({ mealsPerDay: 2 } as never)).toEqual({ lunches: 7, dinners: 7, total: 14 }); // ancien réglage
  });
  it("génère exactement le nombre de repas demandé", () => {
    const w = planWeek(BASE_RECIPES, { idx: BASE_INDEX, settings: { ...DEFAULT_SETTINGS, lunches: 3, dinners: 5, options: { ...DEFAULT_SETTINGS.options, seasonal: false } },
      favorites: [], stock: new Map(), cost: ctxCost, now: new Date(2026, 10, 14), rand: Math.random });
    expect(w.slots.filter((s) => s.meal === "midi").length).toBe(3);
    expect(w.slots.filter((s) => s.meal === "soir").length).toBe(5);
  });
});

import { readFileSync } from "node:fs";
describe("favori « Envoyer à Stoemp »", () => {
  it("le code réellement produit est du JavaScript valide (pas de \\ perdu dans le gabarit)", () => {
    const raw = readFileSync("src/views/Settings.tsx", "utf8").match(/const BOOKMARKLET_SRC = `([\s\S]*?)`;/)![1];
    const real = (0, eval)("`" + raw + "`").replace("APP", '"https://x/#/capture"').replace(/\n/g, "");
    expect(() => new Function(real)).not.toThrow();
  });
});

import { eatersOf, portionsOf, slotPortions } from "../household";
import { drinkFor } from "../drinks";
import { profile } from "../balance";
import { kidUnfriendly } from "../planner";
describe("foyer, réception, restes, boissons, équilibre", () => {
  it("portions : un enfant ≈ 0,6 portion, un ado une portion", () => {
    const e = eatersOf({ persons: 4, adults: 2, teens: 1, kids: 2 });
    expect(portionsOf(e)).toBeCloseTo(4.2);
    expect(eatersOf({ persons: 3 } as never)).toEqual({ adults: 3, teens: 0, kids: 0 }); // ancien réglage
  });
  it("courses : invités, restes du lendemain et services de la réception", () => {
    const slot = (x: Partial<Slot>): Slot => ({ day: 0, meal: "soir", recipeId: "base-pates-carbonara", veg: false, cooked: false, ...x });
    expect(slotPortions(slot({ guests: { adults: 2, kids: 1 } }), 2)).toBeCloseTo(4.6);
    expect(slotPortions(slot({ leftovers: true }), 2)).toBe(4);
    expect(slotPortions(slot({ fromLeftovers: true }), 2)).toBe(0);
    const need = mealNeeds([slot({ leftovers: true }), slot({ day: 1, meal: "midi", fromLeftovers: true }),
      slot({ day: 2, guests: { adults: 2, kids: 0 }, courses: [{ type: "dessert", recipeId: "base-omelette-aux-herbes-et-pommes-de-terre" }] })], recipes, 2, BASE_INDEX);
    expect(need.get("lardons")).toBe(60 * 4 + 60 * 4); // restes (2 + 2) + réception (2 + 2 invités)
    expect(need.get("oeufs")).toBe(1 * 4 + 1 * 4 + 2 * 4); // carbonara ×2 + « dessert » (omelette, 2 œufs) pour 4
  });
  it("boissons : bière avec la carbonnade, vin blanc avec le poisson, rien d'alcoolisé si demandé", () => {
    expect(drinkFor(recipes.get("base-carbonnade-flamande")!, false, BASE_INDEX).adultItem).toBe("biere-brune");
    expect(drinkFor(recipes.get("base-saumon-riz-et-brocoli")!, false, BASE_INDEX).adultItem).toBe("vin-blanc");
    expect(drinkFor(recipes.get("base-saumon-riz-et-brocoli")!, false, BASE_INDEX, true).adult).not.toMatch(/vin|bière/i);
  });
  it("équilibre : profil des repas et plats épicés écartés pour les enfants", () => {
    expect(profile(recipes.get("base-saumon-riz-et-brocoli")!, false, BASE_INDEX)).toEqual({ protein: "poisson", starch: "riz" });
    expect(profile(recipes.get("base-chili-con-carne")!, true, BASE_INDEX).protein).toBe("legumineuses");
    expect(kidUnfriendly(recipes.get("base-chili-con-carne")!, false)).toBe(true);
    expect(kidUnfriendly(recipes.get("base-pates-carbonara")!, false)).toBe(false);
  });
  it("la semaine équilibrée contient du poisson", () => {
    let fish = 0;
    for (let i = 0; i < 20; i++) {
      const w = planWeek(BASE_RECIPES, { idx: BASE_INDEX, settings: { ...DEFAULT_SETTINGS, options: { ...DEFAULT_SETTINGS.options, seasonal: false } }, favorites: [], stock: new Map(), cost: ctxCost, rand: Math.random });
      if (w.slots.some((s) => profile(recipes.get(s.recipeId)!, s.veg, BASE_INDEX).protein === "poisson")) fish++;
    }
    expect(fish).toBeGreaterThanOrEqual(17); // au moins 85 % des semaines
  });
});

describe("carnet de prix compact", () => {
  it("déplie les entrées en fiches de prix avec leurs variantes", async () => {
    const { expandBook, priceAt, emptyBook } = await import("../pricing");
    const shared = expandBook([{ store: "colruyt", e: {
      pates_colruyt: { i: "pates", b: 0, n: "EXEMPLE pâtes", z: 500, un: "g", p: 0.9, u: 0.0018, pr: null, d: "2026-11-17T00:00:00Z", src: "capture", sh: "Colruyt Exempleville",
        f: [["EVERYDAY pâtes", "eco", 0, "", 1000, 0.8, null], ["EXEMPLE pâtes bio", "maison", 1, "", 500, 1.5, null]] },
    } }]);
    const p = shared.get("pates_colruyt")!;
    expect(p).toMatchObject({ itemId: "pates", store: "colruyt", packPrice: 0.9, shop: "Colruyt Exempleville" });
    expect(p.offers![0]).toMatchObject({ name: "EVERYDAY pâtes", tier: "eco", organic: false, ppu: 0.0008 });
    const item = BASE_ITEMS.find((i) => i.id === "pates")!;
    const info = priceAt(item, "colruyt", { ...emptyBook(), shared }, { organic: false, range: "eco", allergens: [] } as never);
    expect(info?.packPrice).toBe(0.8);
  });
});
