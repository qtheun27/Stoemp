import type { ItemDoc } from "../catalog";

// « pâté » et « pâtes » ne doivent pas se confondre une fois les accents retirés.
const norm = (s: string) => s.toLowerCase().replace(/pât[ée]/g, (m) => (m.endsWith("é") ? "patev" : "pate")).replace(/\bpdt\b/g, "pommes de terre").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe");
/** Mots de cuisine équivalents (« abricots séchés » = « abricots secs », « endive » = « chicon »). */
const SYN: Record<string, string> = { seche: "sec", endive: "chicon", carbonnade: "carbonade", boulet: "boulette", cuite: "cuit", entiere: "entier" };
/** Pluriel et féminin ramenés à une forme (« fumées » → « fume », « séchée » → « sec »). */
const stem = (w: string) => { const x = w.replace(/(x|s)$/, "").replace(/ee$/, "e"); return SYN[x] || x; };
const STOP = new Set(["de", "du", "la", "le", "les", "des", "et", "en", "au", "aux", "a", "d", "l", "avec", "sans", "pour", "boite", "bio", "boni", "colruyt", "everyday", "selection", "extra", "fresh", "frais", "fraiche", "fraiches", "belge", "belges", "pce", "pc", "kg", "g", "ready", "to", "eat", "mur", "mure", "murs", "doux", "douce", "flandria", "papillon", "feuille"]);
export const tokens = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);

/** Mots qui changent la nature du produit : si le produit les contient et pas l'article, ce n'est pas le même. */
const DERIVED = ["seche", "sec", "confit", "jus", "soupe", "puree", "chip", "sirop", "compote", "confiture", "sauce", "conserve", "surgele", "glace", "yaourt", "biscuit", "saveur", "arome", "poudre", "pate", "salade", "plante", "graine",
  "bolognaise", "pane", "panee", "caramelise", "farci", "farcie", "gratin", "gratine", "gratinee", "quiche", "wrap", "sandwich", "nugget", "croquette", "tarte", "plat", "curry"];

/** Mots placés devant le nom sans le changer (« Mini concombres », « Jeunes carottes »). */
const LEAD = new Set(["mini", "petit", "petite", "grand", "grande", "gro", "botte", "grosse", "jeune", "nouveau", "nouvelle", "demi", "fin", "fine", "vrai", "vraie"]);
const BRANDS = new Set(["colruyt", "boni", "everyday", "bh", "bio"]);

/**
 * Mot principal d'un nom de produit ou d'article : le premier mot utile après la marque
 * (« COLRUYT salami au poivre » → « salami », « Cuisses de poulet » → « cuisse »).
 */
export function headOf(name: string): string | undefined {
  const words = name.trim().split(/\s+/);
  const hasLower = words.some((w) => /[a-zà-ÿ]/.test(w));
  let i = 0;
  // Marque en capitales en tête (« VAL DIEU Filet Poulet ») — sauf si tout le nom est en capitales.
  while (i < words.length - 1 && (BRANDS.has(norm(words[i])) || (hasLower && !/[a-zà-ÿ]/.test(words[i]) && /[A-Z]/.test(words[i])))) i++;
  return tokens(words.slice(i).join(" ")).find((w) => !LEAD.has(w));
}

/** Deux mots identiques, ou l'un abrège l'autre (« escal. » / « escalope », au moins 5 lettres). */
const same = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 5 && (a.startsWith(b) || b.startsWith(a)));

/** Le mot principal du produit figure dans le nom de l'article (sinon « salami au poivre » serait du poivre). */
export function headFits(productName: string, itemName: string): boolean {
  // Le premier mot en capitales est souvent la marque, parfois le produit (« CAMEMBERT di bufala ») : les deux sont admis.
  const heads = [headOf(productName), tokens(productName).find((w) => !LEAD.has(w))].filter(Boolean) as string[];
  const t = tokens(itemName);
  return heads.some((h) => t.some((w) => same(w, h)));
}

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
    const nameT = tokens(it.name);
    for (const n of [it.name, ...(it.aliases || [])]) {
      const t = tokens(n);
      // Raccourci pour les recettes (« poulet » pour « Filet de poulet ») : trop vague pour un produit de magasin,
      // sauf s'il garde le mot principal (« champignons » pour « Champignons de Paris »). Jamais pour un article ajouté par l'IA.
      if (n !== it.name && t.every((w) => nameT.includes(w)) && ((it as { source?: string }).source === "ia" || !t.includes(nameT[0]))) continue;
      if (!t.length || !t.every((w) => pt.has(w)) || !headFits(productName, n)) continue;
      const itemWords = new Set(t);
      if (DERIVED.some((d) => pt.has(d) && !itemWords.has(d))) continue;
      const len = t.join(" ").length + (it.unit === unit ? 0.5 : 0); // à égalité, la même unité l'emporte
      if (len > bestLen) { best = { item: it, size: s }; bestLen = len; }
    }
  }
  return best;
}

/** Racine des mots (« apéritif » et « apéritives » → « aperit », « saucisse » ≠ « saucisson »). */
const stems = (s: string) => new Set(tokens(s).map((w) => w.replace(/(ive|if|ee|e)$/, "")));

/** Ressemblance entre deux noms d'articles (0 à 1) : mots en commun, en tenant compte des pluriels et des marques. */

export function similarity(a: string, b: string): number {
  const A = stems(a), B = stems(b);
  if (!A.size || !B.size) return 0;
  const inter = [...A].filter((w) => B.has(w)).length;
  // Inclusion complète (« Cacahuètes apéritif » ⊂ « Cacahuètes et noix apéritives ») : très proche.
  if (inter === Math.min(A.size, B.size)) return 0.75 + 0.25 * (inter / Math.max(A.size, B.size));
  return inter / new Set([...A, ...B]).size;
}

/** Article existant très proche (même unité, même rayon, même mot principal), pour ne pas créer de doublon. */
export function similarItem(name: string, unit: string, category: string, items: ItemDoc[], threshold = 0.75): ItemDoc | null {
  let best: ItemDoc | null = null, score = 0;
  for (const it of items) {
    if (it.unit !== unit || it.category !== category) continue;
    if (!headFits(name, it.name)) continue;
    const s = similarity(name, it.name);
    if (s >= threshold && s > score) { best = it; score = s; }
  }
  return best;
}

/**
 * Un alias appris (nom de produit ou proposition de l'IA) convient-il à l'article ?
 * Même mot principal, pas de mot qui change la nature du produit, et des noms assez proches.
 */
export function aliasFits(alias: string, itemName: string): boolean {
  if (!headFits(alias, itemName)) return false;
  const a = new Set(tokens(alias)), n = new Set(tokens(itemName));
  if (DERIVED.some((d) => a.has(d) && !n.has(d))) return false;
  return similarity(alias, itemName) >= 0.5;
}
