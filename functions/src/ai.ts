import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createHash } from "node:crypto";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import type { z } from "zod";

/** Modèle rapide (rangement, correspondances) et modèle plus capable (recettes, tickets). */
export const FAST = "claude-haiku-5-5";
export const SMART = "claude-opus-5-5";

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 }));

type Content = Anthropic.MessageParam["content"];

/**
 * Appel Claude avec sortie JSON contrainte par un schéma zod, puis validée à nouveau côté serveur.
 * Le modèle capable bénéficie du repli automatique côté serveur si une demande est refusée.
 */
export async function askJson<T extends z.ZodTypeAny>(opts: {
  model: string; system: string; content: Content; schema: T; maxTokens?: number; effort?: "low" | "medium" | "high";
}): Promise<z.infer<T>> {
  const params: Record<string, unknown> = {
    model: opts.model,
    max_tokens: opts.maxTokens ?? 8000,
    system: opts.system,
    messages: [{ role: "user", content: opts.content }],
    output_config: { format: zodOutputFormat(opts.schema), effort: opts.effort ?? "low" },
  };
  if (opts.model === SMART) { params.betas = ["server-side-fallback-2026-07-01"]; params.fallbacks = "default"; }
  try {
    const res = (await anthropic().beta.messages.create(params as never)) as unknown as Anthropic.Message;
    if (res.stop_reason === "refusal") throw new HttpsError("failed-precondition", "L'IA a refusé cette demande.");
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return opts.schema.parse(JSON.parse(text));
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    if (e instanceof Anthropic.RateLimitError) throw new HttpsError("resource-exhausted", "IA très sollicitée : réessaie dans un moment.");
    if (e instanceof Anthropic.AuthenticationError) throw new HttpsError("failed-precondition", "Clé API Anthropic manquante ou invalide.");
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
