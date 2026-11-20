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
  /** Clé publique « Certificats push Web » (Firebase → Cloud Messaging) : active les rappels sur les téléphones. */
  vapidKey: string;
  /** Relecture des rangements par l'IA (Sonnet) à la fin de chaque envoi du capteur : environ 0,30 $ par page. */
  priceReview: boolean;
  /** Réglages de départ d'un nouveau foyer. */
  defaults: Pick<Settings, "persons" | "lunches" | "dinners" | "stores" | "shoppingDays" | "mineN">;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  features: { demo: true, ai: true, receipt: true, capture: true, invites: true, multiHousehold: true },
  maintenance: { on: false, message: "Stoemp est en maintenance, reviens dans quelques minutes." },
  banner: { text: "", tone: "info" },
  aiWeekShare: 0.15, // une ou deux surprises par semaine : le reste vient du catalogue, relu et gratuit
  freshDays: 14,
  vapidKey: "",
  priceReview: false,
  defaults: { persons: 2, lunches: 0, dinners: 7, stores: ["colruyt", "renmans"], shoppingDays: [6], mineN: 2 },
};

export const mergeAppConfig = (d: Partial<AppConfig> | undefined): AppConfig => ({
  ...DEFAULT_APP_CONFIG, ...d,
  features: { ...DEFAULT_APP_CONFIG.features, ...(d?.features || {}) },
  maintenance: { ...DEFAULT_APP_CONFIG.maintenance, ...(d?.maintenance || {}) },
  banner: { ...DEFAULT_APP_CONFIG.banner, ...(d?.banner || {}) },
  defaults: { ...DEFAULT_APP_CONFIG.defaults, ...(d?.defaults || {}) },
});
