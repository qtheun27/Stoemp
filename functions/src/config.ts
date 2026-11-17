import { getFirestore } from "firebase-admin/firestore";

/** Tâches IA réglables depuis la console d'administration. */
export const TASKS = ["generateRecipes", "structureMyDish", "readReceipt", "classifyItem", "matchProduct", "extractPrices"] as const;
export type Task = (typeof TASKS)[number];
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface TaskConfig { model: string; effort: Effort; maxTokens: number; enabled: boolean }
export interface AiConfig { enabled: boolean; monthlyBudgetUsd: number; tasks: Record<Task, TaskConfig> }

export const DEFAULT_AI: AiConfig = {
  enabled: true,
  monthlyBudgetUsd: 20,
  tasks: {
    generateRecipes: { model: "claude-opus-5-5", effort: "medium", maxTokens: 16000, enabled: true },
    structureMyDish: { model: "claude-opus-5-5", effort: "low", maxTokens: 8000, enabled: true },
    readReceipt: { model: "claude-opus-5-5", effort: "low", maxTokens: 8000, enabled: true },
    classifyItem: { model: "claude-haiku-5-5", effort: "low", maxTokens: 1000, enabled: true },
    matchProduct: { model: "claude-haiku-5-5", effort: "low", maxTokens: 4000, enabled: true },
    extractPrices: { model: "claude-haiku-5-5", effort: "low", maxTokens: 16000, enabled: true },
  },
};

let cache: { at: number; value: AiConfig } | null = null;
/** Réglages IA (document config/ai), relus au plus toutes les 30 secondes. */
export async function aiConfig(): Promise<AiConfig> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const d = (await getFirestore().collection("config").doc("ai").get()).data() as Partial<AiConfig> | undefined;
  const tasks = { ...DEFAULT_AI.tasks };
  for (const t of TASKS) tasks[t] = { ...DEFAULT_AI.tasks[t], ...(d?.tasks?.[t] || {}) };
  cache = { at: Date.now(), value: { ...DEFAULT_AI, ...d, tasks } };
  return cache.value;
}

/** Prix publics en $ par million de jetons (entrée, sortie) — pour estimer le coût. Modèle inconnu : coût non estimé. */
export const MODEL_PRICES: Record<string, [number, number]> = {
  "claude-fable-5-2": [8, 40], "claude-fable-5-1": [10, 50], "claude-fable-5": [10, 50],
  "claude-opus-5-5": [4, 20], "claude-opus-5": [5, 25], "claude-opus-4-8": [5, 25], "claude-opus-4-7": [5, 25], "claude-opus-4-6": [5, 25],
  "claude-sonnet-5-5": [2, 10], "claude-sonnet-5": [2, 10], "claude-sonnet-4-6": [3, 15],
  "claude-haiku-5-5": [0.1, 0.5], "claude-haiku-4-5": [1, 5],
};
export const costOf = (model: string, inTok: number, outTok: number) => {
  const p = MODEL_PRICES[model];
  return p ? (inTok * p[0] + outTok * p[1]) / 1e6 : null;
};

/** Le modèle accepte-t-il le réglage d'effort ? (familles 4.6 et suivantes, et Opus 4.5) */
export const supportsEffort = (m: string) => /claude-(opus|sonnet|haiku|fable|mythos)-(5|4-[5-9])/.test(m) && !/haiku-4/.test(m);
/** Repli automatique côté serveur en cas de refus (Fable, Opus 5.x, Sonnet 5.5). */
export const supportsFallback = (m: string) => /^claude-(fable-5|opus-5|sonnet-5-5)/.test(m);
