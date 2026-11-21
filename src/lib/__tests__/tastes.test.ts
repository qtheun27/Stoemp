import { describe, expect, it } from "vitest";
import { BASE_INDEX, BASE_RECIPES, mains } from "../catalog";
import { DEFAULT_SETTINGS } from "../defaults";
import { emptyBook } from "../pricing";
import { planWeek } from "../planner";
import { eatersFromPeople, groupScore, hasGroup, newPerson, personScore, tastingDeck, type Person, type Tastes } from "../tastes";

const find = (name: string) => BASE_RECIPES.find((r) => r.name === name)!;
const person = (patch: Partial<Person>): Person => ({ ...newPerson("x"), ...patch });
const T = (people: Person[], ratings: Tastes["ratings"] = {}): Tastes => ({ people, ratings });

// Tirage reproductible : le test ne dépend pas du hasard.
const seeded = (n: number) => () => ((n = (n * 16807) % 2147483647) / 2147483647);

describe("goûts du foyer", () => {
  const moules = find("Moules-frites"), carbonara = find("Pâtes carbonara");
  it("reconnaît les groupes d'ingrédients", () => {
    expect(hasGroup(moules, "fruitsdemer", false, BASE_INDEX)).toBe(true);
    expect(hasGroup(carbonara, "pates", false, BASE_INDEX)).toBe(true);
    expect(hasGroup(carbonara, "fruitsdemer", false, BASE_INDEX)).toBe(false);
  });
  it("un « jamais » d'un seul membre fait presque disparaître le plat pour toute la table", () => {
    const lea = person({ id: "lea", never: ["fruitsdemer"] }), tom = person({ id: "tom", loves: ["fruitsdemer"] });
    expect(personScore(lea, moules, T([lea, tom]), BASE_INDEX)).toBeLessThan(0.1);
    expect(groupScore(moules, T([lea, tom]), BASE_INDEX)).toBeLessThan(groupScore(carbonara, T([lea, tom]), BASE_INDEX));
  });
  it("un plat adoré et bien noté par tous monte", () => {
    const a = person({ id: "a", loves: ["pates"] }), b = person({ id: "b" });
    const t = T([a, b], { a: { [carbonara.id]: 1 }, b: { [carbonara.id]: 1 } });
    expect(groupScore(carbonara, t, BASE_INDEX)).toBeGreaterThan(2);
    expect(groupScore(carbonara, T([a, b], { b: { [carbonara.id]: -1 } }), BASE_INDEX)).toBeLessThan(0.5);
  });
  it("un végétarien mange la version végé ; sans version végé, le plat est écarté", () => {
    const v = person({ id: "v", diet: "vege" });
    expect(personScore(v, carbonara, T([v]), BASE_INDEX)).toBeGreaterThan(0.5); // version végé prévue
    const noSwap = { ...carbonara, vegSwap: [] };
    expect(personScore(v, noSwap, T([v]), BASE_INDEX)).toBeLessThan(0.1);
  });
  it("composition du foyer déduite des profils", () => {
    expect(eatersFromPeople([person({ age: "adulte" }), person({ age: "enfant", diet: "vege" }), person({ age: "ado" })]))
      .toEqual({ adults: 1, teens: 1, kids: 1, vegEaters: 1 });
  });
  it("le planificateur évite les « jamais » et applique les allergies de chacun", () => {
    const people = [person({ id: "a", never: ["champignons"] }), person({ id: "b", allergens: ["gl"] })];
    const settings = { ...DEFAULT_SETTINGS, options: { ...DEFAULT_SETTINGS.options, seasonal: false } };
    const ctx = { idx: BASE_INDEX, settings, favorites: [], stock: new Map(), now: new Date(2026, 10, 14), rand: seeded(7), tastes: T(people),
      cost: { idx: BASE_INDEX, book: emptyBook(), stores: settings.stores, pref: "cheapest" as const, organic: false } };
    let mush = 0;
    for (let k = 0; k < 10; k++) {
      const w = planWeek(BASE_RECIPES, ctx);
      for (const sl of w.slots) {
        const r = BASE_RECIPES.find((x) => x.id === sl.recipeId)!;
        expect(r.ingredients.concat(r.meat).some((i) => BASE_INDEX.get(i.itemId)?.allergens.includes("gl"))).toBe(false);
        if (hasGroup(r, "champignons", false, BASE_INDEX)) mush++;
      }
    }
    expect(mush).toBeLessThanOrEqual(1);
  });
  it("le jeu propose des plats variés, jamais déjà notés", () => {
    const p = person({ id: "p" });
    const pool = mains(BASE_RECIPES);
    const deck = tastingDeck(pool, p, T([p], { p: { [pool[0].id]: 1 } }), 20);
    expect(deck.length).toBe(20);
    expect(deck.some((r) => r.id === pool[0].id)).toBe(false);
    expect(new Set(deck.map((r) => r.cuisine)).size).toBeGreaterThanOrEqual(5);
  });
});

describe("profils reliés aux comptes", () => {
  it("le mien d'abord, puis ceux sans compte ; sans lien, tout le monde", async () => {
    const { newPerson, peopleForDevice } = await import("../tastes");
    const moi = { ...newPerson("Quentin"), uid: "u1" }, ame = { ...newPerson("Amélie"), uid: "u2" }, kid = newPerson("Léa");
    expect(peopleForDevice([ame, kid, moi], "u1").map((p) => p.name)).toEqual(["Quentin", "Léa"]);
    expect(peopleForDevice([ame, kid, moi], "u9").map((p) => p.name)).toEqual(["Amélie", "Léa", "Quentin"]);
  });
});
