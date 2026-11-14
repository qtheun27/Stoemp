import type { Consumption, ConsumptionEvent } from "./types";
import { addDays, daysBetween, parseYmd, today, ymd } from "./season";

export interface Prediction {
  dailyRate: number;
  confidence: Consumption["rateConfidence"];
  purchases: number;
  nextRunOut: Date | null;
}

/**
 * Rythme journalier = quantité moyenne achetée ÷ moyenne pondérée des 3 à 5 derniers intervalles entre achats
 * (les plus récents pèsent plus), corrigé par les sorties enregistrées (repas, manuel, jeté) et par le facteur utilisateur.
 */
export function predict(events: ConsumptionEvent[], stockQty: number, rateFactor = 1, now = today()): Prediction {
  const buys = events.filter((e) => e.type === "achat").sort((a, b) => a.date.localeCompare(b.date));
  const purchases = buys.length;
  let rate = 0;
  if (purchases >= 2) {
    const recent = buys.slice(-6); // jusqu'à 5 intervalles
    const intervals: number[] = [];
    for (let i = 1; i < recent.length; i++) intervals.push(Math.max(1, daysBetween(parseYmd(recent[i - 1].date), parseYmd(recent[i].date))));
    let wSum = 0, iSum = 0;
    intervals.forEach((d, i) => { const w = i + 1; wSum += w; iSum += w * d; });
    const avgInterval = iSum / wSum;
    const avgQty = recent.slice(0, -1).reduce((s, e) => s + e.qty, 0) / (recent.length - 1);
    rate = avgQty / avgInterval;
  }
  // Correction par les sorties enregistrées sur la même période.
  const outs = events.filter((e) => e.type !== "achat");
  if (outs.length >= 2) {
    const first = parseYmd(outs.reduce((m, e) => (e.date < m ? e.date : m), outs[0].date));
    const span = Math.max(7, daysBetween(first, now));
    const outRate = outs.reduce((s, e) => s + e.qty, 0) / span;
    rate = rate ? 0.6 * rate + 0.4 * outRate : outRate;
  }
  rate *= rateFactor;
  const confidence: Prediction["confidence"] = purchases >= 5 ? "haute" : purchases >= 3 ? "moyenne" : rate > 0 ? "faible" : "aucune";
  const nextRunOut = rate > 0 ? addDays(now, Math.floor(Math.max(0, stockQty) / rate)) : null;
  return { dailyRate: rate, confidence, purchases, nextRunOut };
}

/** Ajout automatique à la liste si la rupture tombe avant les prochaines courses + 2 jours (et ≥ 3 achats connus). */
export function shouldAutoAdd(p: Prediction, nextShopping: Date): "auto" | "suggest" | null {
  if (!p.nextRunOut) return null;
  if (p.nextRunOut > addDays(nextShopping, 2)) return null;
  return p.purchases >= 3 ? "auto" : "suggest";
}

/** Garde un historique raisonnable (60 derniers événements). */
export const trimEvents = (ev: ConsumptionEvent[]) => ev.slice(-60);
export const ev = (qty: number, type: ConsumptionEvent["type"], d = today()): ConsumptionEvent => ({ date: ymd(d), qty, type });
