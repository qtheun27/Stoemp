import { describe, expect, it } from "vitest";
import { BASE_INDEX, BASE_ITEMS } from "../catalog";
import { emptyBook } from "../pricing";
import { planGroups, planTips, storeOf, type PlanLine } from "../storeplan";
import type { StoreId } from "../types";

// Prix inventés.
const id = (n: string) => BASE_ITEMS.find((i) => i.name === n)!.id;
const hache = id("Haché de bœuf"), saumon = id("Pavé de saumon"), lait = id("Lait");
const book = emptyBook();
const set = (itemId: string, store: StoreId, packPrice: number, packSize: number) =>
  book.shared.set(`${itemId}_${store}`, { itemId, store, organic: false, productName: "x", packSize, packUnit: BASE_INDEX.get(itemId)!.unit, packPrice, pricePerUnit: packPrice / packSize, fetchedAt: "2026-11-01T00:00:00Z", source: "capture" });
set(hache, "renmans", 6, 500); set(hache, "colruyt", 5, 500);
set(lait, "colruyt", 1, 1000); set(lait, "carrefour", 3, 1000);
const ctx = { idx: BASE_INDEX, book, organic: false };
const stores: StoreId[] = ["colruyt", "renmans", "carrefour"];
const L = (itemId: string, qty: number): PlanLine => ({ id: itemId, itemId, category: BASE_INDEX.get(itemId)!.category, qty, unit: BASE_INDEX.get(itemId)!.unit });
const lines = [L(hache, 500), L(saumon, 500), L(lait, 1000)];

describe("répartition entre magasins", () => {
  it("rayon à part, mais ce que le spécialiste ne vend pas reste au magasin principal", () => {
    const plan = { main: "colruyt" as StoreId, cats: { vi: "renmans" as StoreId } };
    expect(storeOf(lines[0], plan, stores, ctx)).toEqual({ store: "renmans", why: "rayon" });
    expect(storeOf(lines[1], plan, stores, ctx).store).toBe("colruyt"); // poisson : pas chez le boucher
    expect(storeOf(L(id("Épaule d'agneau en morceaux"), 1000), plan, stores, ctx).store).toBe("renmans"); // viande sans prix relevé : chez le boucher quand même
    expect(storeOf(lines[2], { ...plan, items: { [lait]: "carrefour" } }, stores, ctx)).toEqual({ store: "carrefour", why: "article" });
  });
  it("listes par magasin, magasin principal d'abord, avec leur total", () => {
    const g = planGroups(lines, { main: "colruyt", cats: { vi: "renmans" } }, stores, ctx);
    expect(g.map((x) => [x.store, x.lines.length])).toEqual([["colruyt", 2], ["renmans", 1]]);
    expect(g[1].total).toBeCloseTo(6);
  });
  it("conseille un magasin nettement moins cher (prix relevés des deux côtés)", () => {
    const t = planTips(lines, { main: "carrefour", cats: { vi: "renmans" } }, stores, ctx);
    expect(t.map((x) => [x.line.itemId, x.from, x.to])).toEqual([[lait, "carrefour", "colruyt"], [hache, "renmans", "colruyt"]]);
    expect(t[0].save).toBeCloseTo(2);
  });
});

describe("semaine du foyer (jour des courses)", () => {
  it("clé, début et ordre des jours", async () => {
    const { weekKeyOf, startOf, shiftWeek, dayOrder, weekStartFor, ymd } = await import("../season");
    expect(weekKeyOf(new Date(2026, 10, 21), 0)).toBe("2026-W47");
    expect(weekKeyOf(new Date(2026, 10, 23), 5)).toBe("2026-W47-5");
    expect(ymd(startOf("2026-W47-5"))).toBe("2026-11-21");
    expect(shiftWeek("2026-W47-5", 1)).toBe("2026-W48-5");
    expect(ymd(startOf("2026-W47"))).toBe("2026-11-16");
    expect(dayOrder(5)).toEqual([5, 6, 0, 1, 2, 3, 4]);
    expect(weekStartFor({ shoppingDays: [6] })).toBe(5);
  });
});
