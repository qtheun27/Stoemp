import type { Season } from "./types";

export const seasonOfMonth = (m: number): Season => (m >= 3 && m <= 5 ? "P" : m >= 6 && m <= 8 ? "E" : m >= 9 && m <= 11 ? "A" : "H");
export const currentSeason = (d = new Date()) => seasonOfMonth(d.getMonth() + 1);
export const monthsOfSeason = (s: Season): number[] => ({ P: [3, 4, 5], E: [6, 7, 8], A: [9, 10, 11], H: [12, 1, 2] })[s];

/** Clé ISO de semaine : 2026-W46 */
export function isoWeek(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
}
/** Lundi de la semaine ISO. */
export function mondayOf(key: string): Date {
  const [, y, w] = (key.match(/^(\d+)-W(\d+)/) || ["", "1970", "1"]).map(Number);
  const jan4 = new Date(y, 0, 4);
  const day = jan4.getDay() || 7;
  const mon = new Date(y, 0, 4 - day + 1);
  mon.setDate(mon.getDate() + (w - 1) * 7);
  return mon;
}
/**
 * Semaine de repas qui commence le jour `ws` (0 = lundi … 5 = samedi), par ex. le jour des courses.
 * Clé : « 2026-W47 » si elle commence le lundi (format historique), sinon « 2026-W47-5 » (semaine ISO de son premier jour).
 * Les créneaux gardent leur jour de la semaine (`slot.day`, 0 = lundi) : seuls l'ordre et les dates changent.
 */
export const weekStartDay = (key: string) => Number(key.split("-")[2] || 0);
export const weekNo = (key: string) => parseInt(key.split("-W")[1], 10);
export const startOf = (key: string) => addDays(mondayOf(key), weekStartDay(key));
export function startOfWeek(d: Date, ws: number): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  return addDays(x, -(((x.getDay() + 6) % 7 - ws + 7) % 7));
}
export const weekKeyOf = (d: Date, ws: number) => { const s = startOfWeek(d, ws); return ws ? `${isoWeek(s)}-${ws}` : isoWeek(s); };
/** Rang d'un jour (0 = lundi) dans une semaine qui commence le jour ws. */
export const dayPos = (day: number, ws: number) => (day - ws + 7) % 7;
/** Jours de la semaine (0 = lundi) dans l'ordre d'une semaine qui commence le jour ws. */
export const dayOrder = (ws: number) => Array.from({ length: 7 }, (_, i) => (ws + i) % 7);
/** Premier jour de la semaine du foyer : choisi, sinon le premier jour de courses, sinon lundi. */
export const weekStartFor = (s: { weekStart?: number | null; shoppingDays?: number[] }) =>
  s.weekStart ?? (s.shoppingDays?.length ? (s.shoppingDays[0] + 6) % 7 : 0);
export const shiftWeek = (key: string, n: number) => weekKeyOf(addDays(startOf(key), 7 * n), weekStartDay(key));
export const dayMs = 86400000;
export const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseYmd = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / dayMs);

/** Prochain jour de courses (aujourd'hui exclu), jours en 0 = dimanche. */
export function nextShoppingDate(days: number[], from = today()): Date {
  if (!days.length) return addDays(from, 7);
  for (let i = 1; i <= 7; i++) { const d = addDays(from, i); if (days.includes(d.getDay())) return d; }
  return addDays(from, 7);
}
export const frDate = (d: Date | string) =>
  (typeof d === "string" ? parseYmd(d) : d).toLocaleDateString("fr-BE", { weekday: "short", day: "numeric", month: "short" });
