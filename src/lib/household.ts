import type { Settings, Slot } from "./types";

/** Un enfant de 3 à 10 ans mange environ 60 % d'une portion adulte ; un ado, une portion entière. */
export const KID_PORTION = 0.6;

export interface Eaters { adults: number; teens: number; kids: number }

export function eatersOf(s: Pick<Settings, "persons" | "adults" | "teens" | "kids">): Eaters {
  return { adults: s.adults ?? s.persons ?? 2, teens: s.teens ?? 0, kids: s.kids ?? 0 };
}
export const headcount = (e: Eaters) => e.adults + e.teens + e.kids;
export const portionsOf = (e: Eaters) => e.adults + e.teens + KID_PORTION * e.kids;

/** « 2 ad. · 1 ado · 2 enf. » */
export function eatersLabel(e: Eaters) {
  const p = [`${e.adults} ad.`];
  if (e.teens) p.push(`${e.teens} ado${e.teens > 1 ? "s" : ""}`);
  if (e.kids) p.push(`${e.kids} enf.`);
  return p.join(" · ");
}

/** Portions à cuisiner pour un créneau : foyer + invités + restes pour le lendemain ; 0 si ce sont des restes. */
export function slotPortions(slot: Slot, base: number): number {
  if (slot.fromLeftovers) return 0;
  const guests = slot.guests ? slot.guests.adults + KID_PORTION * slot.guests.kids : 0;
  return base + guests + (slot.leftovers ? base : 0);
}
/** Portions pour les autres plats d'une réception (sans les restes). */
export const coursePortions = (slot: Slot, base: number) => base + (slot.guests ? slot.guests.adults + KID_PORTION * slot.guests.kids : 0);
