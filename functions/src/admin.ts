import { getAuth, type UserRecord } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { z } from "zod";
import { anthropic } from "./ai";
import { aiConfig, MODEL_PRICES, supportsEffort } from "./config";
import { rebuildPriceBook } from "./pricebook";

// Console d'administration : réservée aux comptes portant la marque superAdmin (posée avec scripts/super-admin.ts).
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const db = () => getFirestore();
const opts = { region: "europe-west1", timeoutSeconds: 120, memory: "512MiB" as const };

function requireSuper(req: CallableRequest) {
  if (!req.auth?.token.superAdmin) throw new HttpsError("permission-denied", "Réservé à l'administrateur.");
  return req.auth.uid;
}
const parse = <T extends z.ZodTypeAny>(s: T, d: unknown): z.infer<T> => {
  const r = s.safeParse(d);
  if (!r.success) throw new HttpsError("invalid-argument", "Données invalides.");
  return r.data;
};

async function allUsers(): Promise<UserRecord[]> {
  const out: UserRecord[] = [];
  let token: string | undefined;
  do { const r = await getAuth().listUsers(1000, token); out.push(...r.users); token = r.pageToken; } while (token && out.length < 20000);
  return out;
}

/** Liste à jour des modèles disponibles pour ta clé (API Models d'Anthropic). */
export const adminListModels = onCall({ ...opts, secrets: [ANTHROPIC_API_KEY] }, async (req) => {
  requireSuper(req);
  const models: { id: string; name: string; createdAt: string; price: [number, number] | null; effort: boolean }[] = [];
  for await (const m of anthropic().models.list({ limit: 100 })) {
    models.push({ id: m.id, name: m.display_name, createdAt: m.created_at, price: MODEL_PRICES[m.id] || null, effort: supportsEffort(m.id) });
  }
  return { models, fetchedAt: new Date().toISOString() };
});

/** Essai d'un modèle : petite question, durée et réponse. */
export const adminTestModel = onCall({ ...opts, secrets: [ANTHROPIC_API_KEY] }, async (req) => {
  requireSuper(req);
  const { model } = parse(z.object({ model: z.string().max(80) }), req.data);
  const t0 = Date.now();
  try {
    const r = await anthropic().messages.create({ model, max_tokens: 200, messages: [{ role: "user", content: "Réponds en une phrase : un plat de saison belge pour ce soir ?" }] });
    return { ok: true, ms: Date.now() - t0, text: r.content.map((b) => (b.type === "text" ? b.text : "")).join(""), inTok: r.usage.input_tokens, outTok: r.usage.output_tokens };
  } catch (e) { return { ok: false, ms: Date.now() - t0, text: (e as Error).message }; }
});

/** Tableau de bord : utilisateurs, foyers, contenu, IA, prix, robot. */
export const adminStats = onCall(opts, async (req) => {
  requireSuper(req);
  const now = Date.now(), d30 = now - 30 * 86400_000;
  const day = (t: number) => new Date(t).toISOString().slice(0, 10);
  const count = async (q: FirebaseFirestore.Query) => (await q.count().get()).data().count;

  const users = await allUsers();
  const signups: Record<string, number> = {}, active: Record<string, number> = {};
  for (const u of users) {
    const c = Date.parse(u.metadata.creationTime), l = Date.parse(u.metadata.lastRefreshTime || u.metadata.lastSignInTime);
    if (c >= d30) signups[day(c)] = (signups[day(c)] || 0) + 1;
    if (l >= d30) active[day(l)] = (active[day(l)] || 0) + 1;
  }
  const lastActive = (n: number) => users.filter((u) => Date.parse(u.metadata.lastRefreshTime || u.metadata.lastSignInTime) >= now - n * 86400_000).length;

  const logs = (await db().collection("aiLogs").where("at", ">=", d30).get()).docs.map((d) => d.data());
  // Réussi : champ « ok » des appels à Claude ; les photos des plats n'écrivent qu'« error » en cas d'échec.
  const ok = (l: FirebaseFirestore.DocumentData) => (l.ok !== undefined ? !!l.ok : !l.error);
  const ai = { calls: logs.length, errors: logs.filter((l) => !ok(l)).length, cost: 0, inTok: 0, outTok: 0, byDay: {} as Record<string, { calls: number; cost: number }>, byTask: {} as Record<string, { calls: number; cost: number; ms: number; errors: number }>, byModel: {} as Record<string, { calls: number; cost: number }> };
  for (const l of logs) {
    const c = l.cost || 0;
    ai.cost += c; ai.inTok += l.inTok || 0; ai.outTok += l.outTok || 0;
    const k = day(l.at);
    ai.byDay[k] = { calls: (ai.byDay[k]?.calls || 0) + 1, cost: (ai.byDay[k]?.cost || 0) + c };
    const t = (ai.byTask[l.task] ||= { calls: 0, cost: 0, ms: 0, errors: 0 });
    t.calls++; t.cost += c; t.ms += l.ms || 0; if (!ok(l)) t.errors++;
    const m = (ai.byModel[l.model] ||= { calls: 0, cost: 0 }); m.calls++; m.cost += c;
  }
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const monthCost = logs.filter((l) => l.at >= monthStart).reduce((s, l) => s + (l.cost || 0), 0);
  // Budget IA = Claude seulement (les photos ont leur propre plafond).
  const monthClaude = logs.filter((l) => l.at >= monthStart && l.task !== "dishImage").reduce((s, l) => s + (l.cost || 0), 0);
  const recentErrors = logs.filter((l) => !ok(l)).sort((a, b) => b.at - a.at).slice(0, 15).map((l) => ({ at: l.at, task: l.task, model: l.model, error: l.error }));

  const stores = ["colruyt", "renmans", "delhaize", "carrefour", "lidl", "aldi", "intermarche", "ah"];
  const prices: Record<string, { count: number; fresh: number }> = {};
  const freshIso = new Date(now - 14 * 86400_000).toISOString();
  for (const s of stores) {
    prices[s] = { count: await count(db().collection("prices").where("store", "==", s)), fresh: await count(db().collection("prices").where("store", "==", s).where("fetchedAt", ">=", freshIso)) };
  }
  const runs = (await db().collection("scraperRuns").orderBy("endedAt", "desc").limit(6).get()).docs.map((d) => {
    const x = d.data();
    return { ...x, startedAt: x.startedAt?.toMillis?.() || null, endedAt: x.endedAt?.toMillis?.() || null };
  });

  return {
    users: {
      total: users.length, anonymous: users.filter((u) => !u.providerData.length).length, google: users.filter((u) => u.providerData.some((p) => p.providerId === "google.com")).length,
      disabled: users.filter((u) => u.disabled).length, active1: lastActive(1), active7: lastActive(7), active30: lastActive(30), signups, active,
    },
    content: {
      households: await count(db().collection("households")),
      weeks: await count(db().collectionGroup("weeks")),
      shoppingLines: await count(db().collectionGroup("shopping")),
      stockItems: await count(db().collectionGroup("stock")),
      recipesBase: await count(db().collection("recipes").where("source", "==", "base")),
      recipesIa: await count(db().collection("recipes").where("source", "==", "ia")),
      recipesPerso: await count(db().collection("recipes").where("source", "==", "perso")),
      itemsBase: await count(db().collection("items").where("source", "==", "base")),
      itemsIa: await count(db().collection("items").where("source", "==", "ia")),
      aiCache: await count(db().collection("aiCache")),
      matchQueue: await count(db().collection("matchQueue")),
    },
    ai: { ...ai, monthCost, monthClaude, budget: (await aiConfig()).monthlyBudgetUsd, recentErrors },
    prices, runs,
  };
});

/** Utilisateurs avec leurs foyers. */
export const adminListUsers = onCall(opts, async (req) => {
  requireSuper(req);
  const users = await allUsers();
  const docs = new Map((await db().collection("users").get()).docs.map((d) => [d.id, d.data()]));
  return {
    users: users.map((u) => ({
      uid: u.uid, email: u.email || null, name: u.displayName || null, photo: u.photoURL || null,
      providers: u.providerData.map((p) => p.providerId), anonymous: !u.providerData.length, disabled: u.disabled,
      superAdmin: !!u.customClaims?.superAdmin, createdAt: u.metadata.creationTime, lastSeen: u.metadata.lastRefreshTime || u.metadata.lastSignInTime,
      households: (docs.get(u.uid)?.households as string[]) || [],
    })),
  };
});

/** Supprime un foyer et tout son contenu (stock, courses, semaines…), ses plats perso, et le retire des profils. */
async function deleteHousehold(hid: string) {
  const ref = db().collection("households").doc(hid);
  const members = Object.keys(((await ref.get()).get("members") as Record<string, string>) || {});
  const recipes = await db().collection("recipes").where("householdId", "==", hid).get();
  const w = db().bulkWriter();
  recipes.docs.forEach((d) => w.delete(d.ref));
  await w.close();
  await db().recursiveDelete(ref);
  for (const uid of members) {
    const u = db().collection("users").doc(uid);
    const d = (await u.get()).data();
    if (!d) continue;
    const rest = ((d.households as string[]) || []).filter((x) => x !== hid);
    await u.set({ households: rest, current: d.current === hid ? rest[0] || null : d.current ?? null }, { merge: true });
  }
}

/** Foyers dont il était le seul membre. */
async function soleHouseholds(uid: string) {
  const snap = await db().collection("households").where(`members.${uid}`, "in", ["admin", "member"]).get();
  return snap.docs.filter((d) => Object.keys(d.get("members") || {}).length <= 1).map((d) => d.id);
}

export const adminDeleteHousehold = onCall({ ...opts, timeoutSeconds: 300 }, async (req) => {
  requireSuper(req);
  const { householdId } = parse(z.object({ householdId: z.string().min(1) }), req.data);
  await deleteHousehold(householdId);
  return { ok: true };
});

/** Ménage : foyers dont plus aucun membre n'a de compte. */
export const adminCleanOrphanHouseholds = onCall({ ...opts, timeoutSeconds: 540 }, async (req) => {
  requireSuper(req);
  const uids = new Set((await allUsers()).map((u) => u.uid));
  const snap = await db().collection("households").get();
  let removed = 0;
  for (const h of snap.docs) {
    const members = Object.keys(h.get("members") || {});
    if (!members.some((m) => uids.has(m))) { await deleteHousehold(h.id); removed++; }
  }
  return { removed };
});

/** Actions sur un compte : suspendre, réactiver, supprimer, donner/retirer l'accès admin. */
export const adminUpdateUser = onCall(opts, async (req) => {
  const me = requireSuper(req);
  const { uid, action } = parse(z.object({ uid: z.string(), action: z.enum(["disable", "enable", "delete", "makeSuper", "removeSuper"]) }), req.data);
  if (uid === me && action !== "enable") throw new HttpsError("failed-precondition", "Impossible sur ton propre compte.");
  const a = getAuth();
  if (action === "disable" || action === "enable") await a.updateUser(uid, { disabled: action === "disable" });
  if (action === "makeSuper" || action === "removeSuper") await a.setCustomUserClaims(uid, { superAdmin: action === "makeSuper" });
  if (action === "delete") {
    for (const hid of await soleHouseholds(uid)) await deleteHousehold(hid); // ses foyers sans autre membre
    await a.deleteUser(uid);
    await db().collection("users").doc(uid).delete();
  }
  return { ok: true };
});

/** Ménage : comptes démo anonymes inactifs et leurs foyers. */
export const adminCleanAnonymous = onCall({ ...opts, timeoutSeconds: 540 }, async (req) => {
  requireSuper(req);
  const { days } = parse(z.object({ days: z.number().int().min(1).max(365) }), req.data);
  const limit = Date.now() - days * 86400_000;
  let removed = 0;
  for (const u of await allUsers()) {
    if (u.providerData.length || Date.parse(u.metadata.lastRefreshTime || u.metadata.lastSignInTime) > limit) continue;
    for (const hid of await soleHouseholds(u.uid)) await deleteHousehold(hid);
    await db().collection("users").doc(u.uid).delete();
    await getAuth().deleteUser(u.uid);
    removed++;
  }
  return { removed };
});

/** Vide le cache IA (tout, ou une fonction). */
export const adminClearAiCache = onCall({ ...opts, timeoutSeconds: 300 }, async (req) => {
  requireSuper(req);
  const { fn } = parse(z.object({ fn: z.string().nullable() }), req.data);
  const q = fn ? db().collection("aiCache").where("fn", "==", fn) : db().collection("aiCache");
  const snap = await q.get();
  const w = db().bulkWriter();
  snap.docs.forEach((d) => w.delete(d.ref));
  await w.close();
  return { removed: snap.size };
});

/**
 * Fusionne deux articles du catalogue : tout ce qui pointe vers « from » passe sur « into »
 * (prix et variantes, stocks, courses, consommation, prix payés, recettes, correspondances), puis « from » est supprimé.
 */
export const adminMergeItems = onCall({ ...opts, timeoutSeconds: 540 }, async (req) => {
  requireSuper(req);
  const { from, into } = parse(z.object({ from: z.string().min(1), into: z.string().min(1) }), req.data);
  if (from === into) throw new HttpsError("invalid-argument", "Choisis deux articles différents.");
  const fromRef = db().collection("items").doc(from), intoRef = db().collection("items").doc(into);
  const [f, t] = await Promise.all([fromRef.get(), intoRef.get()]);
  if (!f.exists) throw new HttpsError("not-found", "Article à fusionner introuvable.");
  if (f.get("source") === "base") throw new HttpsError("failed-precondition", "Un article de base ne peut pas disparaître : fusionne l'autre article dans celui-ci.");
  const fd = f.data()!, td = t.data() || {};
  const ratio = fd.unit === td.unit ? 1 : null; // unités différentes : quantités non converties
  const moved = { prices: 0, stock: 0, shopping: 0, recipes: 0 };

  // Alias : le nom et les alias de l'ancien article
  await intoRef.set({ aliases: FieldValue.arrayUnion(fd.name, ...(fd.aliases || [])) }, { merge: true });

  // Prix : variantes fusionnées dans le document de l'article cible
  for (const p of (await db().collection("prices").where("itemId", "==", from).get()).docs) {
    const target = db().collection("prices").doc(p.id.replace(from + "_", into + "_"));
    const cur = (await target.get()).data();
    const offers = [...((cur?.offers as { name: string; ppu: number }[]) || []), ...((p.get("offers") as { name: string; ppu: number }[]) || [])];
    const uniq = [...new Map(offers.map((o) => [o.name, o])).values()].sort((a, b) => a.ppu - b.ppu);
    await target.set({ ...p.data(), ...(cur || {}), itemId: into, offers: uniq }, { merge: true });
    await p.ref.delete(); moved.prices++;
  }
  if (moved.prices) await rebuildPriceBook();
  // Données des foyers
  for (const sub of ["stock", "consumption", "paidPrices"]) {
    for (const d of (await db().collectionGroup(sub).get()).docs) {
      if (!(d.id === from || d.id.startsWith(from + "_") || d.get("itemId") === from)) continue;
      const parent = d.ref.parent;
      const newId = d.id === from ? into : d.id.replace(from + "_", into + "_");
      const target = parent.doc(newId), cur = (await target.get()).data();
      if (sub === "stock") await target.set({ ...d.data(), qty: (cur?.qty || 0) + (ratio ? d.get("qty") || 0 : 0), unit: td.unit || d.get("unit") }, { merge: true });
      else if (sub === "consumption") await target.set({ events: [...((cur?.events as unknown[]) || []), ...((d.get("events") as unknown[]) || [])].slice(-60) }, { merge: true });
      else await target.set({ ...d.data(), itemId: into }, { merge: true });
      await d.ref.delete(); if (sub === "stock") moved.stock++;
    }
  }
  for (const d of (await db().collectionGroup("shopping").where("itemId", "==", from).get()).docs) { await d.ref.set({ itemId: into }, { merge: true }); moved.shopping++; }
  // Recettes (plats perso et IA ; les recettes de base sont dans l'appli et n'utilisent que des articles de base)
  for (const r of (await db().collection("recipes").get()).docs) {
    let changed = false;
    const fix = (l: { itemId: string }[] = []) => l.map((i) => (i.itemId === from ? ((changed = true), { ...i, itemId: into }) : i));
    const upd = { ingredients: fix(r.get("ingredients")), meat: fix(r.get("meat")), vegSwap: fix(r.get("vegSwap")) };
    if (changed) { await r.ref.set(upd, { merge: true }); moved.recipes++; }
  }
  for (const m of (await db().collection("productMatches").where("itemId", "==", from).get()).docs) await m.ref.delete();
  await fromRef.delete();
  return { ok: true, moved };
});

/** Supprime un article ajouté par l'IA (et ses prix). Les articles de base ne se suppriment pas. */
export const adminDeleteItem = onCall({ ...opts, timeoutSeconds: 120 }, async (req) => {
  requireSuper(req);
  const { id } = parse(z.object({ id: z.string().min(1) }), req.data);
  const ref = db().collection("items").doc(id), d = await ref.get();
  if (d.get("source") === "base") throw new HttpsError("failed-precondition", "Les articles de base ne se suppriment pas : fusionne plutôt un doublon dedans.");
  const prices = await db().collection("prices").where("itemId", "==", id).get();
  const w = db().bulkWriter();
  prices.docs.forEach((p) => w.delete(p.ref));
  w.delete(ref);
  await w.close();
  if (prices.size) await rebuildPriceBook();
  return { ok: true };
});

/** Reconstruit le carnet de prix compact (tous les magasins). */
export const adminRebuildPriceBook = onCall({ ...opts, timeoutSeconds: 300 }, async (req) => {
  requireSuper(req);
  return { prices: await rebuildPriceBook() };
});
