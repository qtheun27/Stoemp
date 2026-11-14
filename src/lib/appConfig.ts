import type { Settings } from "./types";

/** Réglages dynamiques de l'appli (document config/app), modifiables depuis la console d'administration. */
export interface AppConfig {
  features: { demo: boolean; ai: boolean; receipt: boolean; capture: boolean; invites: boolean; multiHousehold: boolean };
  maintenance: { on: boolean; message: string };
  banner: { text: string; tone: "info" | "warn" };
  /** Part de la semaine inventée par l'IA quand l'option est cochée (0 à 1). */
  aiWeekShare: number;
  /** Un prix est « récent » pendant ce nombre de jours. */
  freshDays: number;
  /** Réglages de départ d'un nouveau foyer. */
  defaults: Pick<Settings, "persons" | "mealsPerDay" | "stores" | "shoppingDays" | "mineN">;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  features: { demo: true, ai: true, receipt: true, capture: true, invites: true, multiHousehold: true },
  maintenance: { on: false, message: "Stoemp est en maintenance, reviens dans quelques minutes." },
  banner: { text: "", tone: "info" },
  aiWeekShare: 0.5,
  freshDays: 14,
  defaults: { persons: 2, mealsPerDay: 1, stores: ["colruyt", "renmans"], shoppingDays: [6], mineN: 2 },
};

export const mergeAppConfig = (d: Partial<AppConfig> | undefined): AppConfig => ({
  ...DEFAULT_APP_CONFIG, ...d,
  features: { ...DEFAULT_APP_CONFIG.features, ...(d?.features || {}) },
  maintenance: { ...DEFAULT_APP_CONFIG.maintenance, ...(d?.maintenance || {}) },
  banner: { ...DEFAULT_APP_CONFIG.banner, ...(d?.banner || {}) },
  defaults: { ...DEFAULT_APP_CONFIG.defaults, ...(d?.defaults || {}) },
});
