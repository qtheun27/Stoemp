import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { setGlobalOptions, logger } from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { askJson, cached } from "./ai";
import { catalogPrompt, createItem, findItem, loadItems, slug, type ItemDoc } from "./catalog";
import { AiRecipe, AiRecipes, ClassifiedItem, Match, NewItems, PageMatches, PageProducts, Receipt } from "./schemas";
import { colruytShop, parseColruyt, type ShopProduct } from "./readers/colruyt";
import { aliasFits, matchItem, similarItem } from "./readers/match";
import { tagsOf, tierOf } from "./readers/tiers";

initializeApp();
setGlobalOptions({ region: "europe-west1", maxInstances: 5 });
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const db = () => getFirestore();
const ai = { secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 300, memory: "512MiB" as const };

const STORES = ["colruyt", "renmans", "delhaize", "carrefour", "lidl", "aldi", "intermarche", "ah"] as const;
const SEASON_LABEL: Record<string, string> = { P: "printemps", E: "été", A: "automne", H: "hiver" };
const ALG_LABEL: Record<string, string> = { gl: "gluten", la: "lait", oe: "œufs", po: "poisson", fc: "fruits à coque", so: "soja", cr: "crustacés" };

function uid(req: CallableRequest): string {
  if (!req.auth) throw new HttpsError("unauthenticated", "Connecte-toi d'abord.");
  return req.auth.uid;
}
async function requireMember(hid: string, u: string, admin = false) {
  const snap = await db().collection("households").doc(hid).get();
  const role = snap.data()?.members?.[u];
  if (!role || (admin && role !== "admin")) throw new HttpsError("permission-denied", "Tu ne fais pas partie de ce foyer.");
  return snap;
}
function input<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpsError("invalid-argument", "Données invalides.");
  return r.data;
}

// ---------- classifyItem : rayon, unité, local, périssable, conservation ----------
const CLASSIFY_SYSTEM = `Tu ranges les articles d'une liste de courses d'un foyer belge (supermarchés Colruyt, Delhaize, Carrefour, boucherie Renmans).
Rayons : fl fruits-légumes, vi boucherie-poisson-charcuterie, fr frais-crèmerie-œufs, bo boulangerie, ep épicerie (conserves, sec, petit-déjeuner, condiments), bs boissons, su surgelés, dr hygiène-entretien-maison.
Unités : g (vendu au poids), ml (liquides), pc (pièces, rouleaux, paquets). Donne le format le plus courant en magasin.`;

async function classify(name: string) {
  return cached("classifyItem", norm(name), () =>
    askJson("classifyItem", { system: CLASSIFY_SYSTEM, content: `Article : « ${name} »`, schema: ClassifiedItem }));
}
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export const classifyItem = onCall(ai, async (req) => {
  uid(req);
  const { name } = input(z.object({ name: z.string().min(1).max(80) }), req.data);
  const items = await loadItems();
  const known = findItem(items, name);
  if (known) return { item: known, created: false };
  const c = await classify(name);
  return { item: await createItem(c, name), created: true };
});

/** Relie les ingrédients IA au catalogue ; crée les articles inconnus via classifyItem. */
async function resolveIngredients(list: { itemId: string | null; newName: string | null; qtyPerPerson: number }[], items: ItemDoc[]) {
  const out: { itemId: string; qtyPerPerson: number }[] = [];
  for (const ing of list) {
    let item = ing.itemId ? items.find((i) => i.id === ing.itemId) : undefined;
    if (!item && (ing.newName || ing.itemId)) {
      const n = ing.newName || ing.itemId!;
      item = findItem(items, n) || (await createItem(await classify(n), n));
    }
    if (item && ing.qtyPerPerson > 0) out.push({ itemId: item.id, qtyPerPerson: Math.round(ing.qtyPerPerson * 100) / 100 });
  }
  return out;
}

const RECIPE_RULES = (catalog: string) => `Tu es un chef de cuisine familiale en Belgique. Recettes simples, en français de Belgique.
Relie chaque ingrédient au catalogue ci-dessous par son identifiant exact (itemId). Si aucun ne convient, mets itemId à null et donne newName (nom générique simple).
Quantités POUR 1 PERSONNE dans l'unité du catalogue (g, ml ou pièces ; une cuillère à soupe ≈ 15 g ou ml). Pas de sel, poivre ni huile.
La protéine animale va dans "meat" et son remplacement végétarien simple dans "vegSwap" avec un nom végé "vegName". Plat déjà végétarien : "meat" et "vegSwap" vides, "vegName" null.
3 à 5 étapes courtes. Saisons : P printemps, E été, A automne, H hiver.
Catalogue (itemId | nom | unité) :
${catalog}`;

// ---------- generateRecipes ----------
export const generateRecipes = onCall(ai, async (req) => {
  const u = uid(req);
  const d = input(z.object({
    householdId: z.string(), n: z.number().int().min(1).max(14), season: z.enum(["P", "E", "A", "H"]),
    options: z.object({
      local: z.boolean(), organic: z.boolean(), veg: z.boolean(), maxTime: z.number().nullable(),
      allergens: z.array(z.string()), avoid: z.array(z.string()), budgetPerPerson: z.number().nullable(),
      kidFriendly: z.boolean().optional(), stockOnly: z.boolean().optional(),
    }),
    knownNames: z.array(z.string()).max(400), stockToUse: z.array(z.string()).max(30),
  }), req.data);
  await requireMember(d.householdId, u);
  const items = await loadItems();
  const o = d.options;
  const constraints = [
    `de saison en ${SEASON_LABEL[d.season]} en Belgique`,
    o.local && "avec surtout des produits belges (légumes, viande, produits laitiers locaux)",
    o.veg && "végétariens (meat et vegSwap vides)",
    o.maxTime && `${o.maxTime} min de préparation maximum`,
    o.allergens.length && `sans : ${o.allergens.map((a) => ALG_LABEL[a] || a).join(", ")}`,
    o.avoid.length && `sans ces ingrédients : ${o.avoid.join(", ")}`,
    o.budgetPerPerson && `économiques (environ ${o.budgetPerPerson.toFixed(2)} € par personne et par repas)`,
    o.kidFriendly && "appréciés des enfants (pas épicés, saveurs douces)",
    o.stockOnly ? d.stockToUse.length && `réalisables UNIQUEMENT avec ces ingrédients déjà à la maison (plus sel, poivre, huile, épices de base) : ${d.stockToUse.join(", ")}`
      : d.stockToUse.length && `qui utilisent si possible : ${d.stockToUse.join(", ")}`,
  ].filter(Boolean).join(" ; ");
  const res = await askJson("generateRecipes", {
    uid: u, schema: AiRecipes, system: RECIPE_RULES(catalogPrompt(items)),
    content: `Propose ${d.n} plats NOUVEAUX, variés et tous différents (cuisine belge, française ou du monde) : ${constraints}.
N'utilise AUCUN de ces plats déjà connus : ${d.knownNames.join(" ; ")}.`,
  });
  const known = new Set(d.knownNames.map(norm));
  const batch = db().batch();
  const out = [];
  for (const r of res.recipes) {
    if (known.has(norm(r.name))) continue;
    const ingredients = await resolveIngredients(r.ingredients, items);
    if (!ingredients.length) continue;
    const meat = await resolveIngredients(r.meat, items);
    const recipe = {
      name: r.name, vegName: meat.length ? r.vegName || `${r.name} (végé)` : null, prepMin: r.prepMin,
      seasons: r.seasons.length ? r.seasons : [d.season], ingredients, meat,
      vegSwap: meat.length ? await resolveIngredients(r.vegSwap, items) : [], steps: r.steps,
      source: "ia", householdId: d.householdId, deleted: false, createdAt: Date.now(),
    };
    const ref = db().collection("recipes").doc(`ia-${slug(r.name)}-${randomBytes(3).toString("hex")}`);
    batch.set(ref, recipe);
    out.push({ id: ref.id, ...recipe });
  }
  await batch.commit();
  return { recipes: out };
});

// ---------- generateMenu : mode « Je reçois » ----------
const COURSE_LABEL: Record<string, string> = { aperitif: "apéritif (bouchées à partager)", entree: "entrée", plat: "plat principal", dessert: "dessert" };

export const generateMenu = onCall(ai, async (req) => {
  const u = uid(req);
  const d = input(z.object({
    householdId: z.string(), season: z.enum(["P", "E", "A", "H"]),
    courses: z.array(z.enum(["aperitif", "entree", "plat", "dessert"])).min(1).max(4),
    keepMain: z.string().max(120).nullable(),
    guests: z.object({ adults: z.number().int().min(1).max(40), kids: z.number().int().min(0).max(30) }),
    options: z.object({ veg: z.boolean(), allergens: z.array(z.string()), avoid: z.array(z.string()), noAlcohol: z.boolean(), budgetPerHead: z.number().nullable() }),
  }), req.data);
  await requireMember(d.householdId, u);
  const items = await loadItems();
  const o = d.options;
  const constraints = [
    `de saison en ${SEASON_LABEL[d.season]} en Belgique`,
    `pour ${d.guests.adults} adultes${d.guests.kids ? ` et ${d.guests.kids} enfants (au moins un élément qui leur plaît à chaque service)` : ""}`,
    o.veg && "végétarien", o.allergens.length && `sans : ${o.allergens.map((a) => ALG_LABEL[a] || a).join(", ")}`,
    o.avoid.length && `sans ces ingrédients : ${o.avoid.join(", ")}`,
    o.budgetPerHead && `budget d'environ ${o.budgetPerHead.toFixed(2)} € par convive pour tout le repas`,
  ].filter(Boolean).join(" ; ");
  const MenuSchema = z.object({
    courses: z.array(AiRecipe.extend({ course: z.enum(["aperitif", "entree", "plat", "dessert"]) })),
    drinks: z.array(z.string()).describe("2 à 4 boissons conseillées (accords), dont une sans alcool"),
  });
  const res = await askJson("generateRecipes", {
    uid: u, schema: MenuSchema, minTokens: 16000, system: RECIPE_RULES(catalogPrompt(items)),
    content: `Compose un menu de réception harmonieux : ${d.courses.map((c) => COURSE_LABEL[c]).join(", ")}${d.keepMain ? `, autour du plat principal déjà prévu « ${d.keepMain} » (ne le redonne pas)` : ""}.
Contraintes : ${constraints}. Recettes faisables à la maison, dont une partie préparable à l'avance.
${o.noAlcohol ? "Boissons : uniquement sans alcool." : "Boissons : accords avec le menu (vins, bières belges) et une option sans alcool."}
Donne exactement un plat par service demandé, avec le champ "course".`,
  });
  const batch = db().batch();
  const out = [];
  for (const r of res.courses.filter((c) => d.courses.includes(c.course))) {
    const ingredients = await resolveIngredients(r.ingredients, items);
    if (!ingredients.length) continue;
    const meat = await resolveIngredients(r.meat, items);
    const recipe = {
      name: r.name, vegName: meat.length ? r.vegName || `${r.name} (végé)` : null, prepMin: r.prepMin, seasons: r.seasons.length ? r.seasons : [d.season],
      ingredients, meat, vegSwap: meat.length ? await resolveIngredients(r.vegSwap, items) : [], steps: r.steps,
      source: "ia", course: r.course, householdId: d.householdId, deleted: false, createdAt: Date.now(),
    };
    const ref = db().collection("recipes").doc(`ia-${slug(r.name)}-${randomBytes(3).toString("hex")}`);
    batch.set(ref, recipe);
    out.push({ id: ref.id, ...recipe });
  }
  await batch.commit();
  return { courses: out, drinks: res.drinks.slice(0, 4) };
});

// ---------- structureMyDish ----------
export const structureMyDish = onCall(ai, async (req) => {
  const u = uid(req);
  const d = input(z.object({
    householdId: z.string(), name: z.string().min(1).max(120), persons: z.number().int().min(1).max(20),
    minutes: z.number().int().min(1).max(600), ingredients: z.string().max(3000), steps: z.string().max(5000),
  }), req.data);
  await requireMember(d.householdId, u);
  const items = await loadItems();
  const res = await askJson("structureMyDish", {
    uid: u, schema: AiRecipes, system: RECIPE_RULES(catalogPrompt(items)),
    content: `Transforme ce plat familial en fiche recette structurée (renvoie exactement 1 recette).
Plat : « ${d.name} » pour ${d.persons} personnes, environ ${d.minutes} min.
Ingrédients donnés (pour ${d.persons} personnes) : ${d.ingredients || "aucun : propose les ingrédients habituels de ce plat"}
Étapes données : ${d.steps || "aucune : propose 3 ou 4 étapes courtes"}
Garde fidèlement les ingrédients et étapes donnés (reformule à peine) et convertis les quantités pour 1 personne. Ajoute une version végétarienne si le plat contient de la viande ou du poisson.`,
  });
  const r = res.recipes[0];
  if (!r) throw new HttpsError("internal", "L'IA n'a pas réussi à structurer ce plat.");
  const meat = await resolveIngredients(r.meat, items);
  const recipe = {
    name: d.name, vegName: meat.length ? r.vegName || `${d.name} (végé)` : null, prepMin: d.minutes,
    seasons: ["P", "E", "A", "H"], ingredients: await resolveIngredients(r.ingredients, items), meat,
    vegSwap: meat.length ? await resolveIngredients(r.vegSwap, items) : [], steps: r.steps,
    source: "perso", householdId: d.householdId, deleted: false, createdAt: Date.now(),
  };
  const ref = db().collection("recipes").doc(`perso-${slug(d.name)}-${randomBytes(3).toString("hex")}`);
  await ref.set(recipe);
  return { recipe: { id: ref.id, ...recipe } };
});

// ---------- matchProduct ----------
const MATCH_SYSTEM = `Tu relies un article générique de liste de courses à un produit d'une enseigne belge.
Choisis le produit qui correspond vraiment à l'article (même produit, pas un dérivé : « Lait » ≠ « Lait de coco », « Poulet » ≠ « Chips saveur poulet »).
Entre plusieurs bons candidats, préfère la marque distributeur et le format courant. Réponds null si aucun ne convient.`;

async function matchProductCore(itemName: string, candidates: { name: string; packSize?: number | null; packUnit?: string | null; price?: number }[]) {
  return cached("matchProduct", { itemName, candidates }, async () => (await askJson("matchProduct", {
    system: MATCH_SYSTEM, schema: Match,
    content: `Article : « ${itemName} »\nProduits :\n${candidates.map((c, i) => `${i}. ${c.name}${c.packSize ? ` (${c.packSize} ${c.packUnit || ""})` : ""}${c.price != null ? ` — ${c.price} €` : ""}`).join("\n")}`,
  })).index);
}

export const matchProduct = onCall(ai, async (req) => {
  uid(req);
  const d = input(z.object({ itemName: z.string().max(120), candidates: z.array(z.object({ name: z.string().max(200), packSize: z.number().nullable().optional(), packUnit: z.string().nullable().optional(), price: z.number().optional() })).max(30) }), req.data);
  const index = await matchProductCore(d.itemName, d.candidates);
  return { index: index != null && index >= 0 && index < d.candidates.length ? index : null };
});

/** File d'attente du robot : cas ambigus résolus par l'IA, correspondance mémorisée pour les passes suivantes. */
export const onMatchQueued = onDocumentCreated({ document: "matchQueue/{id}", ...ai }, async (event) => {
  const data = event.data?.data();
  if (!data) return;
  try {
    const index = await matchProductCore(data.itemName, data.candidates);
    const product = index != null ? data.candidates[index] : null;
    await db().collection("productMatches").doc(`${data.store}_${data.itemId}`).set({
      itemId: data.itemId, store: data.store, productName: product?.name || null, productId: product?.id || null, decidedBy: "ia", at: FieldValue.serverTimestamp(),
    });
  } catch (e) { logger.error("matchQueue", e); }
  await event.data!.ref.delete();
});

// ---------- extractPrices : bouton « Envoyer à Stoemp » pendant la navigation ----------
const EXTRACT_SYSTEM = `Tu extrais les produits et leurs prix d'une page de supermarché belge copiée en texte (souvent une page de catégorie).
Ignore menus, filtres, publicités et produits sans prix. Prix en euros.
Contenance : donne packSize et packUnit (g, ml ou pc) pour le prix affiché.
- Produit vendu au poids (« 2,49 €/kg ») : packSize = 1000, packUnit = "g", price = prix au kilo.
- Vendu au litre : packSize = 1000, packUnit = "ml". À la pièce : packSize = nombre de pièces, packUnit = "pc".
- Lot (« 6 x 1,5 l ») : contenance totale du lot.`;

const MATCH_PAGE_SYSTEM = `Tu relies des produits d'une enseigne belge aux articles génériques d'un catalogue de courses.
Pour chaque produit, donne l'identifiant exact (itemId) de l'article qui correspond vraiment (même produit, pas un dérivé : « Lait » ≠ « Lait de coco », « Poulet » ≠ « Chips saveur poulet »), ou null si aucun.`;

/** Découpe un long texte en morceaux d'environ `size` caractères, sur des fins de ligne. */
function chunks(text: string, size = 18000): string[] {
  const out: string[] = [];
  let cur = "";
  for (const line of text.split("\n")) {
    if (cur.length + line.length > size && cur) { out.push(cur); cur = ""; }
    cur += line + "\n";
  }
  if (cur.trim()) out.push(cur);
  return out;
}

type Row = { itemId: string; organic: boolean; productName: string; size: number; unit: string; price: number; promo: string | null };

/**
 * Enregistre les prix d'une page : toutes les variantes de chaque article (gamme, bio, sans gluten…) fusionnées
 * avec celles déjà connues, le prix le plus bas en résumé, et l'historique seulement quand le prix change.
 */
async function savePrices(store: (typeof STORES)[number], url: string, shop: string | null, rows: Row[]) {
  const now = new Date().toISOString();
  const byItem = new Map<string, Row[]>();
  for (const r of rows) byItem.set(r.itemId, [...(byItem.get(r.itemId) || []), r]);
  const w = db().bulkWriter();
  const saved: { itemId: string; productName: string; packPrice: number }[] = [];
  const keepAfter = new Date(Date.now() - 60 * 86400_000).toISOString();
  for (const [itemId, list] of byItem) {
    const ref = db().collection("prices").doc(`${itemId}_${store}`);
    const prev = (await ref.get()).data();
    // Variantes : celles de cette page remplacent les mêmes produits, les autres restent (sauf si trop anciennes).
    const fresh = list.map((r) => ({ name: r.productName, tier: tierOf(store, r.productName), organic: r.organic, tags: tagsOf(r.productName),
      size: r.size, price: r.price, ppu: r.price / r.size, promo: r.promo, seenAt: now }));
    const names = new Set(fresh.map((o) => o.name));
    const offers = [...fresh, ...((prev?.offers as typeof fresh) || []).filter((o) => !names.has(o.name) && (o.seenAt || "") >= keepAfter)]
      .sort((a, b) => a.ppu - b.ppu).slice(0, 30);
    // Résumé : la variante la moins chère (non bio, sinon bio).
    const best = offers.find((o) => !o.organic) || offers[0];
    const unit = list[0].unit;
    const doc = { itemId, store, shop, organic: best.organic, productName: best.name, url, packSize: best.size, packUnit: unit,
      packPrice: best.price, pricePerUnit: best.ppu, promo: best.promo, promoUntil: null, fetchedAt: now, source: "capture", offers };
    w.set(ref, doc);
    const bio = offers.find((o) => o.organic);
    if (bio) w.set(db().collection("prices").doc(`${itemId}_${store}_bio`), { ...doc, organic: true, productName: bio.name, packSize: bio.size, packPrice: bio.price, pricePerUnit: bio.ppu, promo: bio.promo });
    // Historique uniquement si le prix a changé.
    if (!prev || Math.abs((prev.pricePerUnit || 0) - best.ppu) > 1e-9) {
      const { offers: _o, ...hist } = doc;
      w.create(db().collection("priceHistory").doc(), hist);
    }
    saved.push({ itemId, productName: best.name, packPrice: best.price });
  }
  await w.close();
  return saved;
}

/** Ne garde que les 30 dernières copies brutes de pages. */
async function pruneCaptures() {
  const old = await db().collection("captures").orderBy("at", "desc").offset(30).select().get();
  const w = db().bulkWriter();
  old.docs.forEach((d) => w.delete(d.ref));
  await w.close();
}

const ENRICH_SYSTEM = `${CLASSIFY_SYSTEM}
On te donne des produits d'une enseigne belge absents du catalogue. Pour chacun, propose l'article GÉNÉRIQUE correspondant (sans marque ni variété commerciale : « BONI Royal Gala » → « Pommes Royal Gala » seulement si la variété compte pour les courses, sinon « Pommes »).
L'unité doit permettre d'utiliser le prix affiché : produit vendu au kg → unité g ; à la pièce → pc ; liquide → ml.`;

export const extractPrices = onCall({ ...ai, timeoutSeconds: 540, memory: "1GiB" }, async (req) => {
  const u = uid(req);
  const d = input(z.object({ store: z.enum(STORES), url: z.string().max(500), text: z.string().max(1000000) }), req.data);
  // Copie du texte brut (lecture réservée à l'administrateur) : sert à écrire des lecteurs d'enseigne sans IA.
  await db().collection("captures").add({ store: d.store, url: d.url, text: d.text.slice(0, 900000), length: d.text.length, uid: u, at: Date.now() }).catch(() => {});
  await pruneCaptures().catch(() => {});
  let items = await loadItems();

  // 1. Lecture sans IA quand on connaît le format de l'enseigne.
  const parsed: ShopProduct[] = d.store === "colruyt" ? parseColruyt(d.text) : [];
  if (parsed.length >= 3) {
    const shop = colruytShop(d.text);
    const rows: Row[] = [];
    const unmatched: ShopProduct[] = [];
    for (const p of parsed) {
      const m = matchItem(p.name, p.packSize, p.packUnit, items);
      if (m) rows.push({ itemId: m.item.id, organic: p.organic, productName: p.name, size: m.size, unit: m.item.unit, price: p.price, promo: p.promo });
      else unmatched.push(p);
    }
    // 2. Enrichissement : les produits inconnus deviennent des articles génériques (classés par l'IA, une seule fois).
    const created = new Set<string>();
    for (let i = 0; i < Math.min(unmatched.length, 300); i += 40) {
      const batch = unmatched.slice(i, i + 40);
      try {
        const r = await askJson("classifyItem", { uid: u, schema: NewItems, system: ENRICH_SYSTEM, minTokens: 16000,
          content: batch.map((p, k) => `${k}. ${p.name} — vendu ${p.packUnit === "pc" ? "à la pièce" : p.packSize === 1000 ? (p.packUnit === "g" ? "au kg" : "au litre") : `par ${p.packSize} ${p.packUnit}`}`).join("\n") });
        for (const c of r.items) {
          const p = batch[c.index];
          if (!p || !c.keep) continue;
          const before = items.length;
          // Un article très proche existe déjà : on le réutilise (le nom du produit devient un alias).
          const twin = similarItem(c.name, c.unit, c.category, items);
          const it = twin || (await createItem(c, p.name));
          // Article déjà connu : on retient le nom exact du produit (plus besoin de l'IA la prochaine fois),
          // et le nom générique proposé seulement s'il convient vraiment (sinon « Saucisses de poulet » finirait en « Filet de poulet »).
          const known = items.some((x) => x.id === it.id);
          const learn = known ? [p.name, ...(aliasFits(c.name, it.name) ? [c.name] : [])].filter((n) => n !== it.name && !(it.aliases || []).includes(n)) : [];
          if (learn.length) {
            await db().collection("items").doc(it.id).set({ aliases: FieldValue.arrayUnion(...learn) }, { merge: true });
            it.aliases = [...(it.aliases || []), ...learn]; // aussi dans le cache, pour la suite de la page
          }
          items = await loadItems();
          if (items.length > before) created.add(it.name);
          const m = matchItem(p.name, p.packSize, p.packUnit, [it]) || (it.unit === p.packUnit ? { item: it, size: p.packSize } : null);
          if (m) rows.push({ itemId: m.item.id, organic: p.organic, productName: p.name, size: m.size, unit: m.item.unit, price: p.price, promo: p.promo });
        }
      } catch (e) { logger.warn("Enrichissement partiel", e); }
    }
    const saved = await savePrices(d.store, d.url, shop, rows);
    return { found: parsed.length, saved, created: [...created], shop, reader: "sans IA" };
  }

  // 3. Enseigne au format inconnu : lecture par l'IA, morceau par morceau (un morceau en échec n'arrête pas les autres).
  const catalog = catalogPrompt(items);
  const parts = chunks(d.text, 8000);
  const rows: Row[] = [];
  let found = 0;
  for (let i = 0; i < parts.length; i += 4) {
    const res = await Promise.allSettled(parts.slice(i, i + 4).map(async (part) => {
      const page = await askJson("extractPrices", { uid: u, schema: PageProducts, system: EXTRACT_SYSTEM, minTokens: 16000, content: `Enseigne : ${d.store}\nPage : ${d.url}\n\n${part}` });
      const usable = page.products.filter((p) => p.packSize && p.packUnit && p.price > 0);
      found += usable.length;
      if (!usable.length) return;
      const m = await askJson("matchProduct", {
        uid: u, schema: PageMatches, minTokens: 4000, system: `${MATCH_PAGE_SYSTEM}\nCatalogue (itemId | nom | unité) :\n${catalog}`,
        content: usable.map((p, k) => `${k}. ${[p.brand, p.name].filter(Boolean).join(" ")} (${p.packSize} ${p.packUnit})`).join("\n"),
      });
      for (const x of m.matches) {
        const p = usable[x.index], item = x.itemId ? items.find((it) => it.id === x.itemId) : undefined;
        if (p && item && item.unit === p.packUnit) rows.push({ itemId: item.id, organic: p.organic, productName: [p.brand, p.name].filter(Boolean).join(" "), size: p.packSize!, unit: item.unit, price: p.price, promo: p.promo });
      }
    }));
    res.filter((r) => r.status === "rejected").forEach((r) => logger.warn("Morceau illisible", (r as PromiseRejectedResult).reason));
  }
  const saved = await savePrices(d.store, d.url, null, rows);
  return { found, saved, created: [], shop: null, reader: "IA" };
});

// ---------- readReceipt : photo du ticket de caisse ----------
export const readReceipt = onCall({ ...ai, memory: "1GiB" }, async (req) => {
  const u = uid(req);
  const d = input(z.object({ householdId: z.string(), image: z.string().max(8_000_000), mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]) }), req.data);
  await requireMember(d.householdId, u);
  const r = await askJson("readReceipt", {
    uid: u, schema: Receipt,
    system: "Tu lis des tickets de caisse de supermarchés belges (Colruyt, Delhaize, Carrefour, Renmans, Lidl, Aldi…). Une ligne par article acheté ; ignore totaux, TVA, consignes, cartes de fidélité. Décode les abréviations des libellés.",
    content: [
      { type: "image", source: { type: "base64", media_type: d.mediaType, data: d.image } },
      { type: "text", text: "Lis ce ticket." },
    ],
  });
  const items = await loadItems();
  const lines = r.lines.map((l) => {
    const item = findItem(items, l.name) || findItem(items, l.label);
    return { ...l, itemId: item?.id || null };
  });
  return { store: r.store, date: r.date, lines };
});

// ---------- Invitations ----------
export const createInvite = onCall(async (req) => {
  const u = uid(req);
  const { householdId } = input(z.object({ householdId: z.string() }), req.data);
  const hh = await requireMember(householdId, u, true);
  const app = (await db().collection("config").doc("app").get()).data();
  if (app?.features?.invites === false) throw new HttpsError("failed-precondition", "Les invitations sont désactivées par l'administrateur.");
  const token = randomBytes(12).toString("base64url");
  await db().collection("invites").doc(token).set({ householdId, householdName: hh.data()!.name, createdBy: u, expiresAt: Date.now() + 7 * 86400_000 });
  return { token };
});

export const joinHousehold = onCall(async (req) => {
  const u = uid(req);
  const { token, displayName } = input(z.object({ token: z.string().max(64), displayName: z.string().max(80).optional() }), req.data);
  const ref = db().collection("invites").doc(token);
  const inv = await ref.get();
  if (!inv.exists || inv.data()!.expiresAt < Date.now()) throw new HttpsError("not-found", "Invitation expirée ou invalide.");
  const hid = inv.data()!.householdId as string;
  await db().collection("households").doc(hid).update({
    [`members.${u}`]: "member", [`memberNames.${u}`]: displayName || req.auth?.token.name || "Membre",
  });
  await db().collection("users").doc(u).set({ households: FieldValue.arrayUnion(hid), current: hid }, { merge: true });
  return { householdId: hid, name: inv.data()!.householdName };
});

export * from "./admin";
