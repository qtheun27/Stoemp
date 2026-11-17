import type { Item } from "./types";

// Même logique que functions/src/readers/match.ts (ressemblance de noms d'articles).
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe");
const STOP = new Set(["de", "du", "la", "le", "les", "des", "et", "en", "au", "aux", "a", "d", "l", "avec", "sans", "pour", "boite", "bio", "boni", "everyday", "selection", "extra", "fresh", "frais", "fraiche", "fraiches", "belge", "belges", "pce", "pc", "kg", "g"]);
const tokens = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w)).map((w) => w.replace(/(x|s)$/, ""));

/** Racine courte des mots (« apéritif » et « apéritives » → « aperit »), pour comparer des noms d'articles. */
const stems = (s: string) => new Set(tokens(s).map((w) => w.slice(0, 6)));

export function similarity(a: string, b: string): number {
  const A = stems(a), B = stems(b);
  if (!A.size || !B.size) return 0;
  const inter = [...A].filter((w) => B.has(w)).length;
  if (inter === Math.min(A.size, B.size)) return 0.75 + 0.25 * (inter / Math.max(A.size, B.size));
  return inter / new Set([...A, ...B]).size;
}

export interface DuplicatePair { from: Item; into: Item; score: number }

/**
 * Doublons probables : même unité et même rayon, noms très proches, au moins un article ajouté par l'IA.
 * Sens proposé : vers l'article de base, sinon vers le nom le plus court (le plus générique).
 */
export function findDuplicates(items: Item[], threshold = 0.75): DuplicatePair[] {
  const out: DuplicatePair[] = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    if (a.unit !== b.unit || a.category !== b.category) continue;
    if (a.source !== "ia" && b.source !== "ia") continue;
    const score = Math.max(similarity(a.name, b.name), ...a.aliases.map((x) => similarity(x, b.name)), ...b.aliases.map((x) => similarity(a.name, x)));
    if (score < threshold) continue;
    const intoA = a.source !== "ia" || (b.source === "ia" && a.name.length <= b.name.length);
    out.push(intoA ? { from: b, into: a, score } : { from: a, into: b, score });
  }
  return out.sort((x, y) => y.score - x.score);
}
