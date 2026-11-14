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
  const [y, w] = key.split("-W").map(Number);
  const jan4 = new Date(y, 0, 4);
  const day = jan4.getDay() || 7;
  const mon = new Date(y, 0, 4 - day + 1);
  mon.setDate(mon.getDate() + (w - 1) * 7);
  return mon;
}
export const shiftWeek = (key: string, n: number) => {
  const d = mondayOf(key);
  d.setDate(d.getDate() + 7 * n + 3);
  return isoWeek(d);
};
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
