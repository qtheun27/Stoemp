// Rappels sur le téléphone (notifications push, Firebase Cloud Messaging) — envoyés à heure fixe, heure belge.
//   · 8 h 30 : jour des courses, produits qui périment aujourd'hui ou demain ;
//   · 15 h   : le repas du soir s'il est long (≥ 2 h) — « à lancer maintenant » ;
//   · 17 h   : le repas du soir s'il est plus court.
// Chaque téléphone s'inscrit dans `users/{uid}/devices/{id}` (jeton, foyer, rappels choisis) depuis Réglages → Rappels.
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";

export type Reminders = { courses?: boolean; peremption?: boolean; soir?: boolean };
export interface Device { token: string; hid: string; reminders?: Reminders }
export interface Push { title: string; body: string; link: string; tag: string }

const TZ = "Europe/Brussels";
/** Date et jour à Bruxelles : jour JS (0 = dimanche, comme `shoppingDays`), jour de la semaine Stoemp (0 = lundi), semaine ISO. */
export function brussels(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
    .formatToParts(now).map((x) => [x.type, x.value]));
  const y = Number(p.year), m = Number(p.month), d = Number(p.day);
  const js = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  const t = new Date(Date.UTC(y, m - 1, d)), day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const w = Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
  return { ymd: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, js, day: (js + 6) % 7, week: `${t.getUTCFullYear()}-W${String(w).padStart(2, "0")}` };
}

/** Semaine de repas du foyer qui contient ce jour : commence le jour ws (0 = lundi), clé « 2026-W47 » ou « 2026-W47-5 » (comme l'appli). */
export function weekKeyFor(ymd: string, ws: number): string {
  const t = new Date(`${ymd}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() - (((t.getUTCDay() + 6) % 7 - ws + 7) % 7));
  const iso = brussels(t).week;
  return ws ? `${iso}-${ws}` : iso;
}
/** Premier jour de la semaine du foyer : choisi, sinon le premier jour de courses (0 = dimanche), sinon lundi. */
export const weekStartOf = (st: { weekStart?: number | null; shoppingDays?: number[] } | undefined) =>
  st?.weekStart ?? (st?.shoppingDays?.length ? (st.shoppingDays[0] + 6) % 7 : 0);

const list = (names: string[]) => names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;

/** Rappel du matin : jour des courses (repas prévus) et produits qui périment aujourd'hui ou demain. */
export function morningPushes(o: { shoppingToday: boolean; mealsLeft: number; expiring: { name: string; days: number }[] }, r: Reminders): Push[] {
  const out: Push[] = [];
  if (r.courses && o.shoppingToday) out.push({ title: "🛒 C'est le jour des courses", tag: "courses", link: "#/courses",
    body: o.mealsLeft ? `Ta liste est prête : elle couvre les ${o.mealsLeft} repas encore prévus cette semaine.` : "Ta liste est prête dans Stoemp." });
  if (r.peremption && o.expiring.length) {
    const today = o.expiring.filter((x) => x.days <= 0).map((x) => x.name), soon = o.expiring.filter((x) => x.days > 0).map((x) => x.name);
    const parts = [today.length && `${list(today.slice(0, 3))} ${today.length > 1 ? "périment" : "périme"} aujourd'hui`, soon.length && `${list(soon.slice(0, 3))} demain`].filter(Boolean);
    out.push({ title: "⏳ À utiliser vite", tag: "peremption", link: "#/stock", body: `${parts.join(" ; ")}. Stoemp te propose un repas pour en profiter.` });
  }
  return out;
}

/** Rappel du repas du soir : à 15 h pour un plat long (≥ 2 h), à 17 h pour les autres. */
export function dinnerPush(meal: { name: string; prepMin: number } | null, hour: 15 | 17, r: Reminders): Push | null {
  if (!r.soir || !meal) return null;
  const long = meal.prepMin >= 120;
  if ((hour === 15) !== long) return null;
  const h = Math.floor(meal.prepMin / 60), m = meal.prepMin % 60;
  const dur = h ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
  return { title: `🍽️ Ce soir : ${meal.name}`, tag: "soir", link: "#/semaine",
    body: long ? `Environ ${dur} de cuisson : c'est le moment de le lancer.` : `Environ ${dur}. Bon appétit !` };
}

/** Envoie les rappels (données seules : le service worker de l'appli les affiche) et oublie les téléphones désinscrits. */
async function send(items: { ref: FirebaseFirestore.DocumentReference; token: string; push: Push }[]) {
  const db = getFirestore();
  for (let i = 0; i < items.length; i += 500) {
    const batch = items.slice(i, i + 500);
    const res = await getMessaging().sendEach(batch.map(({ token, push }) => ({
      token, data: { title: push.title, body: push.body, link: push.link, tag: push.tag },
      webpush: { headers: { Urgency: "high", TTL: String(6 * 3600) } },
    })));
    const gone = res.responses.map((r, k) => (!r.success && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(r.error?.code || "") ? batch[k].ref : null)).filter(Boolean);
    await Promise.all(gone.map((ref) => db.recursiveDelete(ref!)));
    logger.info("Rappels envoyés", { envoyés: res.successCount, échecs: res.failureCount, oubliés: gone.length });
  }
}

/** Téléphones inscrits, regroupés par foyer. */
async function devicesByHousehold() {
  const snap = await getFirestore().collectionGroup("devices").get();
  const by = new Map<string, { ref: FirebaseFirestore.DocumentReference; d: Device }[]>();
  for (const doc of snap.docs) {
    const d = doc.data() as Device;
    if (!d.token || !d.hid) continue;
    by.set(d.hid, [...(by.get(d.hid) || []), { ref: doc.ref, d }]);
  }
  return by;
}

export const remindMorning = onSchedule({ schedule: "30 8 * * *", timeZone: TZ, region: "europe-west1", retryCount: 1 }, async () => {
  const db = getFirestore(), now = brussels(), out: Parameters<typeof send>[0] = [];
  const names = new Map((await db.collection("items").select("name").get()).docs.map((d) => [d.id, d.get("name") as string]));
  for (const [hid, devs] of await devicesByHousehold()) {
    const hh = db.collection("households").doc(hid);
    const settings = await hh.collection("meta").doc("settings").get();
    const ws = weekStartOf(settings.data() as never);
    const [week, stock] = await Promise.all([hh.collection("weeks").doc(weekKeyFor(now.ymd, ws)).get(), hh.collection("stock").get()]);
    const shoppingToday = ((settings.get("shoppingDays") as number[] | undefined) || []).includes(now.js);
    const mealsLeft = ((week.get("slots") as { day: number; cooked?: boolean }[] | undefined) || []).filter((s) => !s.cooked && (s.day - ws + 7) % 7 >= (now.day - ws + 7) % 7).length;
    const expiring = stock.docs.map((d) => ({ id: d.id, qty: d.get("qty") as number, exp: d.get("expiresAt") as string | null }))
      .filter((s) => s.qty > 0 && s.exp && s.exp.slice(0, 10) <= addDays(now.ymd, 1))
      .map((s) => ({ name: names.get(s.id) || s.id, days: s.exp!.slice(0, 10) <= now.ymd ? 0 : 1 }));
    for (const { ref, d } of devs) for (const push of morningPushes({ shoppingToday, mealsLeft, expiring }, d.reminders || {})) out.push({ ref, token: d.token, push });
  }
  await send(out);
});

export const remindDinner = onSchedule({ schedule: "0 15,17 * * *", timeZone: TZ, region: "europe-west1", retryCount: 1 }, async () => {
  const db = getFirestore(), now = brussels();
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date())) >= 16 ? 17 : 15;
  const out: Parameters<typeof send>[0] = [];
  for (const [hid, devs] of await devicesByHousehold()) {
    const hh = db.collection("households").doc(hid);
    const ws = weekStartOf((await hh.collection("meta").doc("settings").get()).data() as never);
    const week = await hh.collection("weeks").doc(weekKeyFor(now.ymd, ws)).get();
    const slot = ((week.get("slots") as { day: number; meal: string; recipeId: string; cooked?: boolean; fromLeftovers?: boolean; veg?: boolean }[] | undefined) || [])
      .find((s) => s.day === now.day && s.meal === "soir" && !s.cooked);
    let meal: { name: string; prepMin: number } | null = null;
    if (slot) {
      const r = await db.collection("recipes").doc(slot.recipeId).get();
      if (r.exists) meal = { name: (slot.veg && r.get("vegName")) || r.get("name"), prepMin: slot.fromLeftovers ? 10 : Number(r.get("prepMin")) || 30 };
    }
    for (const { ref, d } of devs) { const push = dinnerPush(meal, hour, d.reminders || {}); if (push) out.push({ ref, token: d.token, push }); }
  }
  await send(out);
});

/** « AAAA-MM-JJ » + n jours. */
export function addDays(ymd: string, n: number) {
  const t = new Date(`${ymd}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
