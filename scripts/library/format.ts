// Recettes de la bibliothèque écrites à la main (fichiers « *.txt » de ce dossier), au format compact :
//
//   @belge                                  ← cuisine des recettes qui suivent
//   ## plat                                 ← type de plat (aperitif, entree, soupe, plat, accompagnement, dessert, patisserie, petitdej)
//   # Carbonnade flamande et frites | 4 | 180 | AH      ← nom | parts | durée totale (min) | saisons (P E A H, ou T = toute l'année)
//   + Oignon 3pc; Bière brune 500ml; Moutarde 2cs; …   ← ingrédients de la recette entière (unité du catalogue, ou cs / cc)
//   = Bœuf à braiser 1000g                             ← viande ou poisson (facultatif)
//   ~ Seitan 600g                                      ← remplacement végé (obligatoire s'il y a « = »)
//   v Carbonnade de seitan et frites                   ← nom de la version végé
//   l                                                  ← repas léger / déjà complet (plat sans féculent, voulu)
//   r                                                  ← remplace le plat de base du même nom (version détaillée)
//   o Ancien nom                                       ← plat renommé : garde la fiche, la photo et les semaines déjà prévues
//   s purée                                            ← accompagnement d'origine, affiché tant qu'on n'en choisit pas un autre
//   g Salade verte                                     ← légume servi à côté, remplaçable (jamais un légume cuit dans le plat)
//   p viande volaille poisson vege                     ← (accompagnement de légumes) avec quoi il s'accorde ; « n » = neutre, va avec toute cuisine européenne
//   - Étape 1 …                                        ← étapes, dans l'ordre
//
// Aucune quantité « par personne » à calculer à la main : l'import divise par le nombre de parts.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BASE_INDEX, BASE_RECIPES, type ItemIndex } from "../../src/lib/catalog";
import { STARCH_RE } from "../../src/lib/balance";
import { CUISINE_ORDER, COURSE_ORDER } from "../../src/lib/constants";
import { keyOf, norm, slug } from "../../src/lib/text";
import type { Course, Cuisine, Season } from "../../src/lib/types";
import { similarity } from "../../functions/src/readers/match";

export interface LibIng { itemId: string; qtyPerPerson: number; spoon?: "cs" | "cc" }
export interface HandRecipe {
  id: string; name: string; vegName: string | null; servings: number; prepMin: number; seasons: Season[];
  cuisine: Cuisine; course: Course; light: boolean; replaces?: string; oldName?: string; sideLabel?: string; wantsReplace?: boolean;
  vegSide?: string[]; pairs?: string[]; neutral?: boolean; rawVeg?: string[]; ingredients: LibIng[]; meat: LibIng[]; vegSwap: LibIng[]; steps: string[]; file: string; line: number;
}

export const LIB_DIR = new URL(".", import.meta.url).pathname;

/** Lit et vérifie un texte de recettes ; renvoie les recettes et la liste des erreurs (fichier:ligne). */
export function parseLibrary(text: string, file: string, idx: ItemIndex = BASE_INDEX) {
  const recipes: HandRecipe[] = [], errors: string[] = [];
  let cuisine: Cuisine | null = null, course: Course | null = null, cur: (HandRecipe & { raw: { g: string; m: string; w: string } }) | null = null;
  const err = (n: number, m: string) => errors.push(`${file}:${n} ${m}`);
  const ings = (s: string, n: number, servings: number): LibIng[] => s.split(";").map((x) => x.trim()).filter(Boolean).flatMap((x) => {
    const m = x.match(/^(.+?)\s+([\d.]+)\s*(g|ml|pc|cs|cc)$/);
    if (!m) { err(n, `ingrédient illisible « ${x} »`); return []; }
    const item = idx.find(m[1]);
    if (!item) { err(n, `article inconnu « ${m[1]} »`); return []; }
    if (![item.name, ...item.aliases].some((a) => keyOf(a) === keyOf(m[1]))) { err(n, `« ${m[1]} » pris pour « ${item.name} » : écris le nom exact`); return []; }
    const u = m[3], q = Number(m[2]);
    if (u !== "cs" && u !== "cc" && u !== item.unit) { err(n, `${item.name} s'achète en ${item.unit}, pas en ${u}`); return []; }
    if (!(q > 0)) { err(n, `quantité nulle pour ${item.name}`); return []; }
    return [{ itemId: item.id, qtyPerPerson: Math.round((q / servings) * 1000) / 1000, ...(u === "cs" || u === "cc" ? { spoon: u as "cs" | "cc" } : {}) }];
  });
  const close = () => {
    if (!cur) return;
    const r = cur;
    const key = r.oldName || r.name;
    if (r.oldName) r.id = `lib-${slug(r.oldName)}`.slice(0, 120);
    if (r.wantsReplace) { const base = BASE_RECIPES.find((b) => norm(b.name) === norm(key)); if (base) r.replaces = base.id; else err(r.line, `« r » : aucun plat de base nommé « ${key} »`); }
    delete r.wantsReplace;
    r.ingredients = ings(r.raw.g, r.line, r.servings);
    if (r.rawVeg?.length) {
      r.vegSide = r.rawVeg.flatMap((nm) => { const it = idx.find(nm);
        if (!it || it.name !== nm) { err(r.line, `« g » : écris le nom exact de l'article (${nm})`); return []; }
        if (!r.ingredients.some((i) => i.itemId === it.id)) { err(r.line, `« g » : ${nm} n'est pas dans les ingrédients`); return []; }
        return [it.id]; });
    }
    delete r.rawVeg; r.meat = ings(r.raw.m, r.line, r.servings); r.vegSwap = ings(r.raw.w, r.line, r.servings);
    const { raw: _raw, ...clean } = r;
    recipes.push(clean);
    cur = null;
  };
  text.split("\n").forEach((l, i) => {
    const n = i + 1, line = l.trim();
    if (!line || line.startsWith("//")) return;
    if (line.startsWith("@")) { close(); const c = line.slice(1).trim() as Cuisine; if (!CUISINE_ORDER.includes(c)) err(n, `cuisine inconnue ${c}`); cuisine = c; return; }
    if (line.startsWith("## ")) { close(); const k = line.slice(3).trim() as Course; if (!COURSE_ORDER.includes(k)) err(n, `type inconnu ${k}`); course = k; return; }
    if (line.startsWith("# ")) {
      close();
      const [name, sv, t, s] = line.slice(2).split("|").map((x) => x.trim());
      if (!cuisine || !course) { err(n, "cuisine ou type manquant avant la recette"); return; }
      const seasons = (s === "T" || !s ? "PEAH" : s).split("") as Season[];
      if (seasons.some((x) => !"PEAH".includes(x))) err(n, `saisons « ${s} »`);
      cur = { id: `lib-${slug(name)}`.slice(0, 120), name, vegName: null, servings: Number(sv), prepMin: Number(t), seasons, cuisine, course, light: false,
        ingredients: [], meat: [], vegSwap: [], steps: [], file, line: n, raw: { g: "", m: "", w: "" } };
      if (!(cur.servings >= 1 && cur.servings <= 24)) err(n, `parts « ${sv} »`);
      if (!(cur.prepMin >= 5 && cur.prepMin <= 1500)) err(n, `durée « ${t} »`);
      return;
    }
    if (!cur) { err(n, `ligne hors recette : ${line}`); return; }
    const c: HandRecipe & { raw: { g: string; m: string; w: string } } = cur;
    const tag = line[0], rest = line.slice(1).trim();
    if (tag === "+") c.raw.g += ";" + rest;
    else if (tag === "=") c.raw.m += ";" + rest;
    else if (tag === "~") c.raw.w += ";" + rest;
    else if (tag === "v") c.vegName = rest;
    else if (tag === "l" && !rest) c.light = true;
    else if (tag === "r" && !rest) c.wantsReplace = true;
    else if (tag === "o" && rest) c.oldName = rest;
    else if (tag === "s" && rest) c.sideLabel = rest;
    else if (tag === "g" && rest) (c.rawVeg ||= []).push(rest);
    else if (tag === "p" && rest) { c.pairs = rest.split(/\s+/); if (c.pairs.some((x) => !["viande", "porc", "volaille", "poisson", "vege"].includes(x))) err(n, `« p » : viande, porc, volaille, poisson ou vege`); }
    else if (tag === "n" && !rest) c.neutral = true;
    else if (tag === "-") c.steps.push(rest);
    else err(n, `ligne inconnue : ${line}`);
  });
  close();
  return { recipes, errors };
}

/** Contrôles de bon sens d'une recette (mêmes règles que pour les recettes écrites par l'IA). */
export function checkRecipe(r: HandRecipe, idx: ItemIndex = BASE_INDEX): string[] {
  const out: string[] = [];
  const all = [...r.ingredients, ...r.meat];
  const name = (id: string) => idx.get(id)?.name || "";
  if (all.length < (r.course === "plat" || r.course === "soupe" ? 3 : 2)) out.push("trop peu d'ingrédients");
  if (r.steps.length < 2 || r.steps.length > 10) out.push(`${r.steps.length} étapes`);
  if (r.steps.some((s) => /placeholder|à compléter|todo/i.test(s) || s.length < 15)) out.push("étape inachevée");
  if (r.meat.length && !r.vegSwap.length) out.push("viande sans version végé");
  if (r.meat.length && !r.vegName) out.push("nom végé manquant");
  if (!r.meat.length && (r.vegSwap.length || r.vegName)) out.push("version végé sans viande");
  const starch = all.some((i) => STARCH_RE.test(name(i.itemId)));
  if (r.course === "plat" && !r.light && !starch) out.push("plat sans féculent (ajoute l'accompagnement ou « l » si c'est un repas complet)");
  if (r.course === "plat" && r.light && starch) out.push("marqué léger mais contient un féculent");
  for (const i of all) { const it = idx.get(i.itemId); if (!it || i.spoon) continue;
    if (it.unit === "pc" ? i.qtyPerPerson > 8 : i.qtyPerPerson > 800) out.push(`quantité énorme : ${it.name} ${i.qtyPerPerson}/pers.`); }
  if (all.some((i) => i.itemId === "eau-plate")) out.push("pas d'eau dans les ingrédients");
  const hours = Math.max(0, ...(r.steps.join(" ").match(/(\d+)\s*h(?:eures?)?\b/gi) || []).map((x) => parseInt(x)));
  if (hours * 60 > r.prepMin + 30) out.push(`durée ${r.prepMin} min mais ${hours} h dans les étapes`);
  return out;
}

/** Toutes les recettes du dossier, vérifiées, sans doublon entre elles ni avec les recettes de base. */
export function loadLibrary(dir = LIB_DIR, idx: ItemIndex = BASE_INDEX) {
  const recipes: HandRecipe[] = [], errors: string[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".txt")).sort()) {
    const res = parseLibrary(readFileSync(join(dir, f), "utf8"), f, idx);
    recipes.push(...res.recipes); errors.push(...res.errors);
  }
  for (const r of recipes) for (const e of checkRecipe(r, idx)) errors.push(`${r.file}:${r.line} ${r.name} : ${e}`);
  const dup = (r: HandRecipe, others: { name: string; course?: Course }[]) => others.find((o) => (o.course || "plat") === r.course && (norm(o.name) === norm(r.name) || similarity(o.name, r.name) >= 0.75));
  recipes.forEach((r, i) => {
    const d = dup(r, recipes.slice(0, i)) || dup(r, BASE_RECIPES.filter((b) => b.id !== r.replaces && !recipes.some((x) => x.replaces === b.id)));
    if (d) errors.push(`${r.file}:${r.line} ${r.name} : doublon de « ${d.name} »`);
  });
  return { recipes, errors };
}

/** Doublon avec une recette déjà en base (même type), pour l'import. */
export const sameDish = (a: string, b: string) => norm(a) === norm(b) || similarity(a, b) >= 0.75;
