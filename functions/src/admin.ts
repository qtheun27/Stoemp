import { getAuth, type UserRecord } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { z } from "zod";
import { anthropic } from "./ai";
import { MODEL_PRICES, supportsEffort } from "./config";

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
  const ai = { calls: logs.length, errors: logs.filter((l) => !l.ok).length, cost: 0, inTok: 0, outTok: 0, byDay: {} as Record<string, { calls: number; cost: number }>, byTask: {} as Record<string, { calls: number; cost: number; ms: number; errors: number }>, byModel: {} as Record<string, { calls: number; cost: number }> };
  for (const l of logs) {
    const c = l.cost || 0;
    ai.cost += c; ai.inTok += l.inTok || 0; ai.outTok += l.outTok || 0;
    const k = day(l.at);
    ai.byDay[k] = { calls: (ai.byDay[k]?.calls || 0) + 1, cost: (ai.byDay[k]?.cost || 0) + c };
    const t = (ai.byTask[l.task] ||= { calls: 0, cost: 0, ms: 0, errors: 0 });
    t.calls++; t.cost += c; t.ms += l.ms || 0; if (!l.ok) t.errors++;
    const m = (ai.byModel[l.model] ||= { calls: 0, cost: 0 }); m.calls++; m.cost += c;
  }
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const monthCost = logs.filter((l) => l.at >= monthStart).reduce((s, l) => s + (l.cost || 0), 0);
  const recentErrors = logs.filter((l) => !l.ok).sort((a, b) => b.at - a.at).slice(0, 15).map((l) => ({ at: l.at, task: l.task, model: l.model, error: l.error }));

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
    ai: { ...ai, monthCost, recentErrors },
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

/** Actions sur un compte : suspendre, réactiver, supprimer, donner/retirer l'accès admin. */
export const adminUpdateUser = onCall(opts, async (req) => {
  const me = requireSuper(req);
  const { uid, action } = parse(z.object({ uid: z.string(), action: z.enum(["disable", "enable", "delete", "makeSuper", "removeSuper"]) }), req.data);
  if (uid === me && action !== "enable") throw new HttpsError("failed-precondition", "Impossible sur ton propre compte.");
  const a = getAuth();
  if (action === "disable" || action === "enable") await a.updateUser(uid, { disabled: action === "disable" });
  if (action === "makeSuper" || action === "removeSuper") await a.setCustomUserClaims(uid, { superAdmin: action === "makeSuper" });
  if (action === "delete") { await a.deleteUser(uid); await db().collection("users").doc(uid).delete(); }
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
    const ud = (await db().collection("users").doc(u.uid).get()).data();
    for (const hid of (ud?.households as string[]) || []) {
      const h = await db().collection("households").doc(hid).get();
      if (h.exists && Object.keys(h.get("members") || {}).length <= 1) await db().recursiveDelete(h.ref);
    }
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
