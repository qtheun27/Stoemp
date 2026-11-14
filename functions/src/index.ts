import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { setGlobalOptions, logger } from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { askJson, cached, FAST, SMART } from "./ai";
import { catalogPrompt, createItem, findItem, loadItems, slug, type ItemDoc } from "./catalog";
import { AiRecipes, ClassifiedItem, Match, PageProducts, Receipt } from "./schemas";

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
    askJson({ model: FAST, system: CLASSIFY_SYSTEM, content: `Article : « ${name} »`, schema: ClassifiedItem, maxTokens: 1000 }));
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
    d.stockToUse.length && `qui utilisent si possible : ${d.stockToUse.join(", ")}`,
  ].filter(Boolean).join(" ; ");
  const res = await askJson({
    model: SMART, effort: "medium", maxTokens: 16000, schema: AiRecipes, system: RECIPE_RULES(catalogPrompt(items)),
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

// ---------- structureMyDish ----------
export const structureMyDish = onCall(ai, async (req) => {
  const u = uid(req);
  const d = input(z.object({
    householdId: z.string(), name: z.string().min(1).max(120), persons: z.number().int().min(1).max(20),
    minutes: z.number().int().min(1).max(600), ingredients: z.string().max(3000), steps: z.string().max(5000),
  }), req.data);
  await requireMember(d.householdId, u);
  const items = await loadItems();
  const res = await askJson({
    model: SMART, effort: "low", schema: AiRecipes, system: RECIPE_RULES(catalogPrompt(items)),
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
  return cached("matchProduct", { itemName, candidates }, async () => (await askJson({
    model: FAST, system: MATCH_SYSTEM, schema: Match, maxTokens: 500,
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
export const extractPrices = onCall(ai, async (req) => {
  uid(req);
  const d = input(z.object({ store: z.enum(STORES), url: z.string().max(500), text: z.string().max(60000) }), req.data);
  const page = await askJson({
    model: FAST, maxTokens: 8000, schema: PageProducts,
    system: "Tu extrais les produits et prix visibles d'une page de supermarché belge copiée en texte. Ignore menus, publicités et produits sans prix. Prix en euros.",
    content: `Enseigne : ${d.store}\nPage : ${d.url}\n\n${d.text}`,
  });
  const items = await loadItems();
  const now = new Date().toISOString();
  const saved: { itemId: string; productName: string; packPrice: number }[] = [];
  for (const p of page.products) {
    if (!p.packSize || !p.packUnit || p.price <= 0) continue;
    // Correspondance : nom générique exact, sinon IA rapide sur le catalogue restreint au même mot-clé.
    const words = norm(p.name).split(/[^a-z]+/).filter((w) => w.length > 3);
    const cands = items.filter((i) => i.unit === p.packUnit && words.some((w) => norm(i.name).includes(w.replace(/s$/, ""))));
    if (!cands.length) continue;
    const idx = await matchProductCore(p.name, cands.slice(0, 20).map((c) => ({ name: c.name })));
    const item = idx != null ? cands[idx] : undefined;
    if (!item) continue;
    const pricePerUnit = p.price / p.packSize;
    const id = `${item.id}_${d.store}${p.organic ? "_bio" : ""}`;
    const ref = db().collection("prices").doc(id);
    const prev = await ref.get();
    // On garde le prix au kilo/litre le plus bas parmi les produits correspondants de la même page.
    if (prev.exists && prev.data()!.fetchedAt?.slice(0, 10) === now.slice(0, 10) && prev.data()!.pricePerUnit <= pricePerUnit) continue;
    const doc = { itemId: item.id, store: d.store, organic: p.organic, productName: [p.brand, p.name].filter(Boolean).join(" "), url: d.url,
      packSize: p.packSize, packUnit: p.packUnit, packPrice: p.price, pricePerUnit, promo: p.promo, promoUntil: null, fetchedAt: now, source: "capture" };
    await ref.set(doc);
    await db().collection("priceHistory").add(doc);
    saved.push({ itemId: item.id, productName: doc.productName, packPrice: p.price });
  }
  return { found: page.products.length, saved };
});

// ---------- readReceipt : photo du ticket de caisse ----------
export const readReceipt = onCall({ ...ai, memory: "1GiB" }, async (req) => {
  const u = uid(req);
  const d = input(z.object({ householdId: z.string(), image: z.string().max(8_000_000), mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]) }), req.data);
  await requireMember(d.householdId, u);
  const r = await askJson({
    model: SMART, effort: "low", maxTokens: 8000, schema: Receipt,
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
