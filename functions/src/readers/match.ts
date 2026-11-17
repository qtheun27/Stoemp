import type { ItemDoc } from "../catalog";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe");
const STOP = new Set(["de", "du", "la", "le", "les", "des", "et", "en", "au", "aux", "a", "d", "l", "avec", "sans", "pour", "boite", "bio", "boni", "everyday", "selection", "extra", "fresh", "frais", "fraiche", "fraiches", "belge", "belges", "pce", "pc", "kg", "g", "ready", "to", "eat", "mur", "mure", "murs", "doux", "douce", "flandria", "papillon", "feuille"]);
export const tokens = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w)).map((w) => w.replace(/(x|s)$/, ""));

/** Mots qui changent la nature du produit : si le produit les contient et pas l'article, ce n'est pas le même. */
const DERIVED = ["seche", "sec", "confit", "jus", "soupe", "puree", "chip", "sirop", "compote", "confiture", "sauce", "conserve", "surgele", "glace", "yaourt", "biscuit", "saveur", "arome", "poudre", "pate", "salade", "plante", "graine"];

/** Poids moyen d'une pièce (g) pour convertir « vendu au kilo » ↔ « compté à la pièce ». */
const PIECE_G: Record<string, number> = {
  oignon: 150, "oignon-rouge": 150, echalote: 40, ail: 50, poivron: 200, chicons: 125, citron: 110, concombre: 400,
  avocat: 200, "chou-fleur": 1000, brocoli: 500, "salade-verte": 400, "salade-romaine": 450, "grosses-tomates": 180,
  kiwis: 90, potiron: 1500, "courge-butternut": 1200, fenouil: 300, "chou-rouge": 1200, "chou-vert": 1200, "celeri-rave": 800,
  celeri: 500, carottes: 100, pommes: 180, poires: 180, oranges: 200, clementines: 70, bananes: 180, mangue: 400, ananas: 1200, melon: 1200,
};

export interface Match { item: ItemDoc; size: number } // size : contenance du produit dans l'unité de l'article

/**
 * Correspondance sans IA : tous les mots de l'article (nom ou alias) doivent figurer dans le nom du produit,
 * le produit ne doit pas être un dérivé, et l'unité doit être compatible (ou convertible avec le poids moyen d'une pièce).
 * Le nom d'article le plus précis gagne.
 */
export function matchItem(productName: string, size: number, unit: "g" | "ml" | "pc", items: ItemDoc[]): Match | null {
  const pt = new Set(tokens(productName));
  let best: Match | null = null, bestLen = 0;
  for (const it of items) {
    let s: number | null = null;
    if (it.unit === unit) s = size;
    else if (unit === "g" && it.unit === "pc" && PIECE_G[it.id]) s = size / PIECE_G[it.id];
    else if (unit === "pc" && it.unit === "g" && PIECE_G[it.id]) s = size * PIECE_G[it.id];
    if (s == null || s <= 0) continue;
    for (const n of [it.name, ...(it.aliases || [])]) {
      const t = tokens(n);
      if (!t.length || !t.every((w) => pt.has(w))) continue;
      const itemWords = new Set(t);
      if (DERIVED.some((d) => pt.has(d) && !itemWords.has(d))) continue;
      const len = t.join(" ").length + (it.unit === unit ? 0.5 : 0); // à égalité, la même unité l'emporte
      if (len > bestLen) { best = { item: it, size: s }; bestLen = len; }
    }
  }
  return best;
}
