import { call } from "../../firebase";

export interface Model { id: string; name: string; createdAt: string; price: [number, number] | null; effort: boolean }
export interface AdminUser { uid: string; email: string | null; name: string | null; photo: string | null; providers: string[]; anonymous: boolean; disabled: boolean; superAdmin: boolean; createdAt: string; lastSeen: string; households: string[] }
export interface Stats {
  users: { total: number; anonymous: number; google: number; disabled: number; active1: number; active7: number; active30: number; signups: Record<string, number>; active: Record<string, number> };
  content: Record<string, number>;
  ai: { calls: number; errors: number; cost: number; inTok: number; outTok: number; monthCost: number; monthClaude?: number; budget?: number; byDay: Record<string, { calls: number; cost: number }>; byTask: Record<string, { calls: number; cost: number; ms: number; errors: number }>; byModel: Record<string, { calls: number; cost: number }>; recentErrors: { at: number; task: string; model: string; error: string }[] };
  prices: Record<string, { count: number; fresh: number }>;
  runs: Record<string, unknown>[];
}

export const adminStats = call<unknown, Stats>("adminStats");
export const adminListModels = call<unknown, { models: Model[]; fetchedAt: string }>("adminListModels");
export const adminTestModel = call<{ model: string }, { ok: boolean; ms: number; text: string; inTok?: number; outTok?: number }>("adminTestModel");
export const adminListUsers = call<unknown, { users: AdminUser[] }>("adminListUsers");
export const adminUpdateUser = call<{ uid: string; action: "disable" | "enable" | "delete" | "makeSuper" | "removeSuper" }, { ok: boolean }>("adminUpdateUser");
export const adminCleanAnonymous = call<{ days: number }, { removed: number }>("adminCleanAnonymous");
export const adminDeleteHousehold = call<{ householdId: string }, { ok: boolean }>("adminDeleteHousehold");
export const adminCleanOrphanHouseholds = call<unknown, { removed: number }>("adminCleanOrphanHouseholds");
export const adminMergeItems = call<{ from: string; into: string }, { ok: boolean; moved: { prices: number; stock: number; shopping: number; recipes: number } }>("adminMergeItems");
export const adminDeleteItem = call<{ id: string }, { ok: boolean }>("adminDeleteItem");
export const adminLibraryJob = call<{ action: "start" | "pause" | "resume" | "stop"; perCuisine?: Record<string, number>; cuisines?: string[] }, { ok: boolean }>("adminLibraryJob");
export const adminRebuildPriceBook = call<unknown, { prices: number }>("adminRebuildPriceBook");
export const adminClearAiCache = call<{ fn: string | null }, { removed: number }>("adminClearAiCache");

/** 30 derniers jours, du plus ancien au plus récent. */
export const last30 = () => [...Array(30)].map((_, i) => new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10));
export const usd = (n: number) => n.toLocaleString("fr-BE", { style: "currency", currency: "USD", maximumFractionDigits: n < 1 ? 3 : 2 });
export const dt = (s: string | number | null | undefined) => (s ? new Date(s).toLocaleString("fr-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
