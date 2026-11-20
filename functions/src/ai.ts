import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createHash } from "node:crypto";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import type { z } from "zod";
import { aiConfig, costOf, supportsEffort, supportsFallback, type Task } from "./config";

let client: Anthropic | null = null;
export const anthropic = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 }));

type Content = Anthropic.MessageParam["content"];

/** Dépense IA estimée du mois en cours (somme du journal aiLogs). */
async function monthSpend(): Promise<number> {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const snap = await getFirestore().collection("aiLogs").where("at", ">=", start).select("cost", "task").get();
  // Budget IA = appels à Claude seulement : les photos des plats (Google) ont leur propre plafond (images.ts, PHOTOS_MAX_MOIS).
  return snap.docs.reduce((s, x) => s + (x.get("task") === "dishImage" ? 0 : x.get("cost") || 0), 0);
}
let spendCache: { at: number; v: number } | null = null;

/**
 * Appel Claude pour une tâche : modèle, effort et plafond lus dans la configuration (console d'administration),
 * sortie JSON contrainte par un schéma zod puis revalidée, journalisation (jetons, coût, durée, erreurs).
 */
/** Tâches de simple classement : sans réflexion interne. */
const NO_THINKING = new Set<Task>(["classifyItem", "matchProduct"]);

export async function askJson<T extends z.ZodTypeAny>(task: Task, opts: { system: string; content: Content; schema: T; uid?: string; minTokens?: number }): Promise<z.infer<T>> {
  const cfg = await aiConfig();
  const tc = cfg.tasks[task];
  if (!cfg.enabled || !tc.enabled) throw new HttpsError("failed-precondition", "Cette fonction IA est désactivée par l'administrateur.");
  if (!spendCache || Date.now() - spendCache.at > 60_000) spendCache = { at: Date.now(), v: await monthSpend() };
  if (cfg.monthlyBudgetUsd > 0 && spendCache.v >= cfg.monthlyBudgetUsd) throw new HttpsError("resource-exhausted", "Budget IA du mois atteint.");

  const params: Record<string, unknown> = {
    model: tc.model, max_tokens: Math.max(tc.maxTokens, opts.minTokens || 0), system: opts.system,
    messages: [{ role: "user", content: opts.content }],
    // Cache du préfixe (consignes + catalogue, identiques d'un appel à l'autre) : relu pour ~10 % du prix.
    cache_control: { type: "ephemeral" },
    output_config: { format: zodOutputFormat(opts.schema), ...(supportsEffort(tc.model) ? { effort: tc.effort } : {}) },
  };
  if (supportsFallback(tc.model)) { params.betas = ["server-side-fallback-2026-07-01"]; params.fallbacks = "default"; }
  // Petites tâches de classement sur Haiku : pas de réflexion interne (inutile ici, et c'était l'essentiel du coût).
  if (/haiku-5/.test(tc.model) && NO_THINKING.has(task) && ["low", "medium", "high"].includes(tc.effort)) params.thinking = { type: "disabled" };
  const t0 = Date.now();
  const log = (data: Record<string, unknown>) =>
    getFirestore().collection("aiLogs").add({ task, model: tc.model, uid: opts.uid || null, ms: Date.now() - t0, at: Date.now(), ...data }).catch(() => {});
  try {
    const res = (await anthropic().beta.messages.create(params as never)) as unknown as Anthropic.Message;
    const inTok = res.usage?.input_tokens || 0, outTok = res.usage?.output_tokens || 0;
    const cost = costOf(res.model || tc.model, inTok, outTok);
    if (spendCache && cost) spendCache.v += cost;
    if (res.stop_reason === "refusal") { await log({ ok: false, error: "refus", inTok, outTok, cost, served: res.model }); throw new HttpsError("failed-precondition", "L'IA a refusé cette demande."); }
    if (res.stop_reason === "max_tokens") { await log({ ok: false, error: "réponse trop longue (jetons max atteints)", inTok, outTok, cost, served: res.model }); throw new HttpsError("resource-exhausted", "Réponse IA trop longue : augmente les jetons max dans la console."); }
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const parsed = opts.schema.parse(JSON.parse(text));
    await log({ ok: true, inTok, outTok, cost, served: res.model });
    return parsed;
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    await log({ ok: false, error: (e as Error).message?.slice(0, 300) || "erreur" });
    if (e instanceof Anthropic.RateLimitError) throw new HttpsError("resource-exhausted", "IA très sollicitée : réessaie dans un moment.");
    if (e instanceof Anthropic.AuthenticationError) throw new HttpsError("failed-precondition", "Clé API Anthropic manquante ou invalide.");
    if (e instanceof Anthropic.NotFoundError) throw new HttpsError("failed-precondition", `Modèle « ${tc.model} » indisponible : change-le dans la console d'administration.`);
    logger.error("Appel IA en échec", e);
    throw new HttpsError("internal", "L'IA n'a pas répondu correctement.");
  }
}

/** Cache Firestore des réponses IA déterministes (rangement, correspondances). */
export async function cached<T>(fn: string, input: unknown, compute: () => Promise<T>): Promise<T> {
  const key = createHash("sha256").update(fn + JSON.stringify(input)).digest("hex").slice(0, 40);
  const ref = getFirestore().collection("aiCache").doc(key);
  const snap = await ref.get();
  if (snap.exists) return snap.data()!.value as T;
  const value = await compute();
  await ref.set({ fn, value, createdAt: FieldValue.serverTimestamp() });
  return value;
}
