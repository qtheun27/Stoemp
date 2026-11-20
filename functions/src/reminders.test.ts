import { describe, expect, it } from "vitest";
import { addDays, brussels, dinnerPush, morningPushes } from "./reminders";

describe("rappels", () => {
  it("date belge : jour, semaine ISO, passage de minuit", () => {
    const b = brussels(new Date("2026-11-20T23:30:00Z")); // samedi 21 à 0 h 30 à Bruxelles
    expect(b).toMatchObject({ ymd: "2026-11-21", js: 6, day: 5, week: "2026-W47" });
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("matin : jour des courses et produits qui périment, seulement si choisis", () => {
    const o = { shoppingToday: true, mealsLeft: 4, expiring: [{ name: "Épinards frais", days: 0 }, { name: "Yaourt nature", days: 1 }] };
    const p = morningPushes(o, { courses: true, peremption: true });
    expect(p.map((x) => x.tag)).toEqual(["courses", "peremption"]);
    expect(p[0].body).toContain("4 repas");
    expect(p[1].body).toBe("Épinards frais périme aujourd'hui ; Yaourt nature demain. Stoemp te propose un repas pour en profiter.");
    expect(morningPushes(o, { courses: false, peremption: false })).toEqual([]);
    expect(morningPushes({ ...o, shoppingToday: false, expiring: [] }, { courses: true, peremption: true })).toEqual([]);
  });
  it("soir : plat long à 15 h, plat court à 17 h, jamais les deux", () => {
    const long = { name: "Carbonnade flamande", prepMin: 200 }, court = { name: "Omelette", prepMin: 20 };
    expect(dinnerPush(long, 15, { soir: true })?.body).toBe("Environ 3 h 20 de cuisson : c'est le moment de le lancer.");
    expect(dinnerPush(long, 17, { soir: true })).toBeNull();
    expect(dinnerPush(court, 17, { soir: true })?.title).toBe("🍽️ Ce soir : Omelette");
    expect(dinnerPush(court, 15, { soir: true })).toBeNull();
    expect(dinnerPush(court, 17, { soir: false })).toBeNull();
  });
});
