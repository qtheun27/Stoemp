import { arrayUnion, deleteDoc, deleteField, doc, setDoc, updateDoc, writeBatch, collection } from "firebase/firestore";
import { auth, call, db } from "../firebase";
import { cookable, ingredientsOf, isVegRecipe, mains } from "../lib/catalog";
import { guessCategory } from "../lib/classify";
import { DEFAULT_SETTINGS } from "../lib/defaults";
import { parseLine } from "../lib/parse";
import { mealCounts, planSeason, planWeek, pickOne, poolFor, weekFrame, daysToExpiry, type PlanCtx } from "../lib/planner";
import { trimEvents, ev } from "../lib/predict";
import type { PriceSel } from "../lib/pricing";
import { eatersOf, portionsOf, slotPortions, coursePortions } from "../lib/household";
import { addDays, today, ymd } from "../lib/season";
import { keyOf, slug } from "../lib/text";
import type { Cat, Consumption, ConsumptionEvent, EventType, Ingredient, Item, Location, Recipe, Settings, ShoppingDoc, Slot, StockEntry, StoreId } from "../lib/types";
import { mealParts, vegPortions } from "../lib/mixed";
import { assignSides, sideOptions, slotRecipe, vegOptions } from "../lib/sides";
import { eatersFromPeople, TASTE_GROUPS, type Person, type Rating } from "../lib/tastes";
import { isoWeek } from "../lib/season";
import { baseQty } from "../lib/units";
import type { HistoryEntry, Prefs, StoreState } from "./store";

const hh = (hid: string, ...p: string[]) => doc(db, "households", hid, ...p);
const clean = <T extends object>(o: T) => JSON.parse(JSON.stringify(o)) as T; // retire les undefined

export const defaultLocation = (c: Cat): Location =>
  c === "su" ? "congelateur" : c === "dr" ? "salle-de-bain" : c === "bs" ? "cave" : ["fl", "vi", "fr"].includes(c) ? "frigo" : "placard";

// ---------------- Foyers ----------------
export async function createHousehold(name: string, demo = false, defaults?: Partial<Settings>) {
  const u = auth.currentUser!;
  const ref = doc(collection(db, "households"));
  await setDoc(ref, { name, members: { [u.uid]: "admin" }, memberNames: { [u.uid]: u.displayName || (demo ? "Invité" : "Moi") }, createdAt: Date.now() });
  await setDoc(hh(ref.id, "meta", "settings"), clean({ ...DEFAULT_SETTINGS, ...(defaults || {}) }));
  await setDoc(hh(ref.id, "meta", "prefs"), { favorites: [], learnedCategories: {}, history: {} });
  await setDoc(doc(db, "users", u.uid), { households: arrayUnion(ref.id), current: ref.id }, { merge: true });
  return ref.id;
}
export const switchHousehold = (id: string) => setDoc(doc(db, "users", auth.currentUser!.uid), { current: id }, { merge: true });
export const renameHousehold = (hid: string, name: string) => updateDoc(doc(db, "households", hid), { name });
export async function removeMember(hid: string, uid: string) {
  await updateDoc(doc(db, "households", hid), { [`members.${uid}`]: deleteField(), [`memberNames.${uid}`]: deleteField() });
}
export async function setRole(hid: string, uid: string, role: "admin" | "member") {
  await updateDoc(doc(db, "households", hid), { [`members.${uid}`]: role });
}
export async function leaveHousehold(hid: string, remaining: string[]) {
  const u = auth.currentUser!;
  await removeMember(hid, u.uid);
  await setDoc(doc(db, "users", u.uid), { households: remaining, current: remaining[0] || null }, { merge: true });
}
export const createInvite = call<{ householdId: string }, { token: string }>("createInvite");
export const joinHousehold = call<{ token: string; displayName?: string }, { householdId: string; name: string }>("joinHousehold");

// ---------------- Réglages & préférences ----------------
export const saveSettings = (hid: string, patch: Partial<Settings>) => setDoc(hh(hid, "meta", "settings"), clean(patch), { merge: true });
export const savePrefs = (hid: string, patch: Partial<Prefs>) => setDoc(hh(hid, "meta", "prefs"), clean(patch), { merge: true });
export const toggleFavorite = (hid: string, prefs: Prefs, id: string) =>
  savePrefs(hid, { favorites: prefs.favorites.includes(id) ? prefs.favorites.filter((x) => x !== id) : [...prefs.favorites, id] });

// ---------------- Semaine ----------------
type GenResult = { recipes: Recipe[] };
const generateRecipesFn = call<unknown, GenResult>("generateRecipes");

/** Préférences de prix du foyer : bio, gamme, allergies. */
export const priceSel = (s: StoreState): PriceSel => ({ organic: s.settings.options.organic, range: s.settings.options.range || "maison", allergens: s.settings.options.allergens });

export function planCtx(s: StoreState): PlanCtx {
  return {
    idx: s.idx, settings: s.settings, favorites: s.prefs.favorites, stock: s.stock, tastes: s.tastes,
    cost: { idx: s.idx, book: s.book, stores: s.settings.stores, pref: s.settings.preferredStore, organic: priceSel(s) },
  };
}

/** Articles du stock à écouler en priorité (ceux qui périment bientôt d'abord). */
export function stockToUse(s: StoreState, max = 12) {
  return [...s.stock.entries()]
    .filter(([id, e]) => e.qty > 0 && !s.idx.get(id)?.staple && s.idx.get(id)?.category !== "dr")
    .sort((a, b) => daysToExpiry(a[1]) - daysToExpiry(b[1]))
    .slice(0, max).map(([id]) => s.idx.get(id)?.name || id);
}

/** Portions de base du foyer (un enfant ≈ 0,6 portion). */
export const basePortions = (s: StoreState) => s.week?.persons ?? portionsOf(eatersOf(s.settings));
/** Végétariens d'un foyer mixte (aucun si tout le foyer est végé). */
export const vegCfg = (s: StoreState) => ({ vegEaters: s.settings.options.veg ? 0 : s.settings.vegEaters || 0 });

async function aiRecipes(s: StoreState, n: number, extra: { stockOnly?: boolean } = {}): Promise<Recipe[]> {
  const o = s.settings.options;
  const e = eatersOf(s.settings);
  const res = await generateRecipesFn({
    householdId: s.hid, n, season: planSeason(o),
    options: {
      local: o.local, organic: o.organic, veg: o.veg, maxTime: o.timeOn ? o.maxTime : null,
      // Allergies et « jamais dans mon assiette » de chaque membre du foyer.
      allergens: [...new Set([...o.allergens, ...s.tastes.people.flatMap((p) => p.allergens)])],
      avoid: [...new Set([...o.avoid, ...s.tastes.people.flatMap((p) => p.never.map((k) => TASTE_GROUPS[k]?.label.toLowerCase()).filter(Boolean) as string[])])].slice(0, 30),
      budgetPerPerson: o.budgetOn ? o.budget / Math.max(0.5, portionsOf(e)) / Math.max(1, mealCounts(s.settings).total) : null,
      kidFriendly: !!o.kidFriendly && e.kids > 0, stockOnly: !!extra.stockOnly, cuisines: o.cuisines || [],
    },
    // Tous les plats principaux déjà connus (base, bibliothèque, plats du foyer) : l'IA n'en propose pas de doublon.
    knownNames: [...new Set(mains(s.recipes.values()).filter((r) => !r.deleted).map((r) => r.name))].slice(0, 1500),
    stockToUse: o.useStock || extra.stockOnly ? stockToUse(s, extra.stockOnly ? 30 : 12) : [],
  });
  return res.recipes;
}

export async function generateWeek(s: StoreState): Promise<string | undefined> {
  const pool = mains(s.recipes.values());
  let fresh: Recipe[] = [];
  let note: string | undefined;
  if (s.settings.options.ai && s.app.features.ai) {
    if (!s.online) note = "Hors ligne : plats de la base utilisés.";
    else {
      try {
        const N = weekFrame(s.settings).filter((f) => f.meal !== "matin" && !f.light).length;
        fresh = await aiRecipes(s, Math.max(1, Math.min(14, Math.ceil((N - s.settings.mineN) * s.app.aiWeekShare))));
      } catch (e) { note = (e as Error).message || "IA indisponible : plats de la base utilisés."; }
    }
  }
  const res = planWeek([...pool, ...fresh], planCtx(s), fresh, cookable(s.recipes.values()));
  if (!res.slots.length) throw new Error(res.warning);
  // Un accompagnement proposé d'office pour chaque plat où il est interchangeable (modifiable dans la fiche).
  const slots = assignSides(res.slots, s.recipes, s.idx, Math.random, s.prefs.sides, s.prefs.vegSides);
  await setDoc(hh(s.hid!, "weeks", s.weekKey), { slots, persons: portionsOf(eatersOf(s.settings)), warning: res.warning || null, generatedAt: Date.now() });
  return note || res.warning;
}

export const saveSlots = (s: StoreState, slots: Slot[]) => setDoc(hh(s.hid!, "weeks", s.weekKey), { slots }, { merge: true });

/** Place une recette sur le premier repas libre de la semaine (à partir d'aujourd'hui). Renvoie le jour, ou null. */
export async function placeRecipe(s: StoreState, r: Recipe): Promise<number | null> {
  const slots = [...(s.week?.slots || [])];
  const todayIdx = s.weekKey === isoWeek() ? (new Date().getDay() + 6) % 7 : -1;
  const k = slots.findIndex((x) => !x.cooked && !x.fromLeftovers && (todayIdx < 0 || x.day >= todayIdx));
  if (k < 0) return null;
  slots[k] = { ...slots[k], recipeId: r.id, veg: s.settings.options.veg && !isVegRecipe(r) && r.source !== "pret", cooked: false };
  await saveSlots(s, slots);
  return slots[k].day;
}

export async function swapSlot(s: StoreState, k: number, useAi: boolean) {
  const slots = [...(s.week?.slots || [])];
  let r: Recipe | null = null;
  const sl = slots[k];
  if (useAi && !sl.light && sl.meal !== "matin" && s.online && s.app.features.ai) { try { r = (await aiRecipes(s, 1))[0] || null; } catch { r = null; } }
  if (!r) r = pickOne(poolFor(sl, cookable(s.recipes.values())), planCtx(s), new Set(slots.map((x) => x.recipeId)));
  if (!r) throw new Error("Aucun autre repas possible avec ces options.");
  const { side: _side, vegSide: _veg, ...rest } = slots[k];
  slots[k] = { ...rest, recipeId: r.id, veg: s.settings.options.veg && !isVegRecipe(r), cooked: false };
  slots[k] = assignSides([slots[k]], s.recipes, s.idx, Math.random, s.prefs.sides, s.prefs.vegSides)[0];
  await saveSlots(s, slots);
}

// ---------------- Restes, réception, frigo vide ----------------
const MEAL_RANK = { matin: 0, midi: 1, soir: 2 } as const;
const sortSlots = (l: Slot[]) => l.sort((a, b) => a.day - b.day || MEAL_RANK[a.meal] - MEAL_RANK[b.meal]);

/** Passe un repas de complet à léger (ou l'inverse) : un autre plat adapté est choisi, et le réglage est retenu pour les prochaines semaines. */
export async function setSlotLight(s: StoreState, k: number, light: boolean) {
  const slots = [...(s.week?.slots || [])];
  const sl = slots[k];
  if (!sl || sl.meal === "matin") return;
  const r = pickOne(poolFor({ meal: sl.meal, light }, cookable(s.recipes.values())), planCtx(s), new Set(slots.map((x) => x.recipeId)));
  if (!r) throw new Error(light ? "Aucun repas léger possible avec ces options." : "Aucun repas complet possible avec ces options.");
  const { side: _side, vegSide: _veg, ...rest } = sl;
  slots[k] = { ...rest, light, recipeId: r.id, veg: s.settings.options.veg && !isVegRecipe(r), cooked: false, leftovers: false };
  await saveSlots(s, assignSides(slots, s.recipes, s.idx, Math.random, s.prefs.sides, s.prefs.vegSides).map((x, i) => (i === k ? x : slots[i])));
  const key = `${sl.day}-${sl.meal}`, cur = new Set(s.settings.lightSlots || []);
  if (light) cur.add(key); else cur.delete(key);
  await saveSettings(s.hid!, { lightSlots: [...cur] });
}

/** « Cuisiner aussi pour demain midi » : double la portion du soir et remplit le midi suivant avec les restes. */
export async function toggleLeftovers(s: StoreState, k: number, on: boolean) {
  const slots = [...(s.week?.slots || [])];
  const sl = slots[k];
  if (!sl || sl.meal !== "soir") return;
  const next = sl.day + 1;
  if (on && next > 6) throw new Error("Dernier soir de la semaine : pas de lendemain midi dans ce planning.");
  const li = slots.findIndex((x) => x.day === next && x.meal === "midi");
  if (on) {
    slots[k] = { ...sl, leftovers: true };
    const lunch: Slot = { day: next, meal: "midi", recipeId: sl.recipeId, veg: sl.veg, cooked: false, fromLeftovers: true };
    if (li >= 0) slots[li] = { ...lunch, prevRecipeId: slots[li].recipeId, addedForLeftovers: false };
    else slots.push({ ...lunch, addedForLeftovers: true });
  } else {
    slots[k] = { ...sl, leftovers: false };
    if (li >= 0 && slots[li].fromLeftovers) {
      if (slots[li].addedForLeftovers) slots.splice(li, 1);
      else slots[li] = { ...slots[li], recipeId: slots[li].prevRecipeId || slots[li].recipeId, fromLeftovers: false, prevRecipeId: null };
    }
  }
  await saveSlots(s, sortSlots(slots).map((x) => clean(x)));
}

export interface MenuRecipe extends Recipe { course: "aperitif" | "entree" | "plat" | "dessert" }
const generateMenuFn = call<unknown, { courses: MenuRecipe[]; drinks: string[] }>("generateMenu");

/** Mode « Je reçois » : menu complet (apéritif, entrée, plat, dessert) et boissons pour le foyer et ses invités. */
export async function receive(s: StoreState, k: number, cfg: { adults: number; kids: number; courses: ("aperitif" | "entree" | "dessert")[]; newMain: boolean; budgetPerHead: number | null }) {
  const slots = [...(s.week?.slots || [])];
  const sl = slots[k];
  const main = slotRecipe(s.recipes, sl, s.idx);
  const o = s.settings.options;
  const e = eatersOf(s.settings);
  const res = await generateMenuFn({
    householdId: s.hid, season: planSeason(o), courses: [...cfg.courses, ...(cfg.newMain ? ["plat"] : [])],
    keepMain: cfg.newMain ? null : main?.name || null,
    guests: { adults: e.adults + e.teens + cfg.adults, kids: e.kids + cfg.kids },
    options: { veg: o.veg, allergens: o.allergens, avoid: o.avoid, noAlcohol: !!o.noAlcohol, budgetPerHead: cfg.budgetPerHead },
  });
  const plat = res.courses.find((c) => c.course === "plat");
  slots[k] = clean({ ...sl, recipeId: plat?.id || sl.recipeId, cooked: false, guests: { adults: cfg.adults, kids: cfg.kids },
    courses: res.courses.filter((c) => c.course !== "plat").map((c) => ({ type: c.course as "aperitif" | "entree" | "dessert", recipeId: c.id })), drinks: res.drinks });
  await saveSlots(s, slots);
  return true;
}
export async function cancelReception(s: StoreState, k: number) {
  const slots = [...(s.week?.slots || [])];
  slots[k] = { ...slots[k], guests: null, courses: null, drinks: null };
  await saveSlots(s, slots.map((x) => clean(x)));
}

/** Recettes réalisables avec le stock (part des ingrédients déjà à la maison, hors fond de placard). */
export function fridgeIdeas(s: StoreState) {
  const out: { r: Recipe; coverage: number; missing: string[] }[] = [];
  for (const r of mains(s.recipes.values())) {
    if (r.deleted) continue;
    const ings = ingredientsOf(r, s.settings.options.veg).filter((i) => !s.idx.get(i.itemId)?.staple);
    if (!ings.length) continue;
    const have = ings.filter((i) => (s.stock.get(i.itemId)?.qty || 0) > 0);
    const coverage = have.length / ings.length;
    if (coverage >= 0.5) out.push({ r, coverage, missing: ings.filter((i) => !have.includes(i)).map((i) => s.idx.get(i.itemId)?.name || i.itemId) });
  }
  return out.sort((a, b) => b.coverage - a.coverage).slice(0, 8);
}
/** Un plat inventé par l'IA avec uniquement le stock (et le fond de placard). */
export const fridgeRecipe = async (s: StoreState) => (await aiRecipes(s, 1, { stockOnly: true }))[0] || null;

// ---------------- Stock & consommation ----------------
function pushEvent(s: StoreState, b: ReturnType<typeof writeBatch>, itemId: string, qty: number, type: EventType) {
  const c: Consumption = s.consumption.get(itemId) || { events: [], dailyRate: 0, rateConfidence: "aucune", nextRunOut: null };
  const events: ConsumptionEvent[] = trimEvents([...c.events, ev(qty, type)]);
  b.set(hh(s.hid!, "consumption", itemId), { ...c, events }, { merge: true });
}

function stockAfter(s: StoreState, item: Item, delta: number, patch: Partial<StockEntry> = {}): StockEntry {
  const cur = s.stock.get(item.id);
  const qty = Math.max(0, (cur?.qty || 0) + delta);
  let expiresAt = cur?.expiresAt ?? null;
  if (delta > 0 && item.perishable && !patch.expiresAt) {
    const exp = ymd(addDays(today(), item.shelfLifeDays));
    if (!expiresAt || (cur?.qty || 0) <= 0) expiresAt = exp; // nouvel achat : date du lot le plus ancien conservée sinon
  }
  return clean({ qty, unit: item.unit, location: cur?.location || defaultLocation(item.category), minQty: cur?.minQty ?? null, ...patch, expiresAt: patch.expiresAt ?? expiresAt, updatedAt: Date.now() });
}

/** Repas cuisiné : déduit les ingrédients du stock (ou annule). */
export async function setCooked(s: StoreState, k: number, cooked: boolean) {
  const slots = [...(s.week?.slots || [])];
  const slot = slots[k];
  const r = slotRecipe(s.recipes, slot, s.idx);
  slots[k] = { ...slot, cooked };
  const b = writeBatch(db);
  b.set(hh(s.hid!, "weeks", s.weekKey), { slots }, { merge: true });
  const base = basePortions(s);
  // Plat (parts avec viande et parts végé d'un foyer mixte) + autres services d'une réception.
  const parts: [Ingredient[], number][] = [
    ...(r ? mealParts(r, slot.veg, slotPortions(slot, base), vegPortions(slot, vegCfg(s), base), s.settings.options.allergens).map((p) => [p.ings, p.portions] as [Ingredient[], number]) : []),
    ...(slot.courses || []).map((c) => { const cr = s.recipes.get(c.recipeId); return [cr ? ingredientsOf(cr, false) : [], coursePortions(slot, base)] as [Ingredient[], number]; })];
  for (const [ings, portions] of parts) if (portions > 0) for (const ing of ings) {
    const item = s.idx.get(ing.itemId);
    if (!item) continue;
    const q = baseQty(ing, item) * portions;
    const cur = s.stock.get(item.id);
    if (!cur && item.staple) continue;
    if (!cur && !cooked) continue;
    b.set(hh(s.hid!, "stock", item.id), stockAfter(s, item, cooked ? -q : q));
    if (cooked) pushEvent(s, b, item.id, q, "repas");
  }
  await b.commit();
}

export async function adjustStock(s: StoreState, itemId: string, delta: number, type: EventType | null = "manuel") {
  const item = s.idx.get(itemId);
  if (!item) return;
  const b = writeBatch(db);
  b.set(hh(s.hid!, "stock", itemId), stockAfter(s, item, delta));
  if (type && delta < 0) pushEvent(s, b, itemId, -delta, type);
  if (type === "achat" && delta > 0) pushEvent(s, b, itemId, delta, "achat");
  await b.commit();
}
export async function setStockEntry(s: StoreState, itemId: string, patch: Partial<StockEntry>) {
  const item = s.idx.get(itemId);
  if (!item) return;
  const cur = s.stock.get(itemId);
  await setDoc(hh(s.hid!, "stock", itemId), clean({ ...stockAfter(s, item, 0), ...cur, ...patch, unit: item.unit, updatedAt: Date.now() }));
}
export async function finishItem(s: StoreState, itemId: string, type: "manuel" | "jeté") {
  const cur = s.stock.get(itemId);
  if (!cur) return;
  const b = writeBatch(db);
  b.set(hh(s.hid!, "stock", itemId), { ...cur, qty: 0, expiresAt: null, updatedAt: Date.now() });
  if (cur.qty > 0) pushEvent(s, b, itemId, cur.qty, type);
  await b.commit();
}
export const deleteStock = (s: StoreState, itemId: string) => deleteDoc(hh(s.hid!, "stock", itemId));
/** « On en consomme plus / moins » : facteur appliqué au rythme. */
export const setRateFactor = (s: StoreState, itemId: string, f: number) =>
  setDoc(hh(s.hid!, "consumption", itemId), { rateFactor: Math.min(4, Math.max(0.25, f)) }, { merge: true });

/** Mise en place rapide : niveau approximatif (1 = plein, 0,5 = moitié, 0,15 = presque fini). */
export async function quickSetup(s: StoreState, entries: { itemId: string; level: number }[]) {
  const b = writeBatch(db);
  for (const { itemId, level } of entries) {
    const item = s.idx.get(itemId);
    if (!item) continue;
    b.set(hh(s.hid!, "stock", itemId), stockAfter(s, item, item.packSize * level - (s.stock.get(itemId)?.qty || 0)));
  }
  await b.commit();
}

// ---------------- Courses ----------------
const classifyFn = call<{ name: string }, { item: Item }>("classifyItem");

/** Ajout en texte libre : dictionnaire du catalogue, puis rayon appris, puis devinette, puis IA si inconnu. */
export async function addManual(s: StoreState, text: string): Promise<string> {
  const p = parseLine(text);
  if (!p) return "";
  const item = s.idx.find(p.name);
  const k = keyOf(item?.name || p.name);
  const name = item?.name || p.name;
  let category: Cat = s.prefs.learnedCategories[k] || item?.category || guessCategory(p.name) || "ep";
  let qty = p.qty, unit: ShoppingDoc["unit"] = p.unit === "cs" || p.unit === "cc" ? "" : p.unit;
  if (item && !qty) { qty = item.packSize; unit = item.unit; }
  const id = "m_" + slug(name);
  const existing = s.shopping.find((d) => d.id === id);
  await setDoc(hh(s.hid!, "shopping", id), clean({
    id, itemId: item?.id || null, name, qty: existing && !existing.checked && qty ? existing.qty + qty : qty, unit, reason: "manuel",
    category, checked: false, removed: false, addedAt: Date.now(),
  }));
  const h: HistoryEntry = s.prefs.history[k] || { name, count: 0, itemId: item?.id || null, category };
  await setDoc(hh(s.hid!, "meta", "prefs"), { history: { [k]: { ...h, name, count: h.count + 1, category } } }, { merge: true });
  // Article inconnu : l'IA le classe et l'ajoute au catalogue partagé.
  if (!item && !s.prefs.learnedCategories[k] && s.online) {
    classifyFn({ name: p.name }).then(async ({ item: it }) => {
      category = it.category;
      await setDoc(hh(s.hid!, "shopping", id), { itemId: it.id, category, unit: unit || it.unit, qty: qty || it.packSize }, { merge: true });
    }).catch(() => {});
  }
  return name;
}

/** Correction du rayon : mémorisée pour ce foyer. */
export async function setCategory(s: StoreState, line: { id: string; name: string }, c: Cat) {
  await setDoc(hh(s.hid!, "shopping", line.id), { category: c }, { merge: true });
  await setDoc(hh(s.hid!, "meta", "prefs"), { learnedCategories: { [keyOf(line.name)]: c } }, { merge: true });
}

export interface LineRef { id: string; itemId: string | null; name: string; qty: number; unit: ShoppingDoc["unit"]; reason: ShoppingDoc["reason"]; category: Cat; checked: boolean; pricePaid?: number | null; store?: string | null }

/** Cocher = acheté : l'article entre dans le stock (et l'achat nourrit la prédiction). Décocher annule. */
export async function checkLine(s: StoreState, l: LineRef, checked: boolean) {
  const b = writeBatch(db);
  const item = l.itemId ? s.idx.get(l.itemId) : undefined;
  const prev = s.shopping.find((d) => d.id === l.id);
  const qty = item ? (l.qty || item.packSize) : 0;
  b.set(hh(s.hid!, "shopping", l.id), clean({
    ...(prev || {}), id: l.id, itemId: l.itemId, name: l.name, qty: l.qty, unit: l.unit, reason: l.reason, category: l.category,
    checked, addedToStock: checked ? qty : 0, addedAt: prev?.addedAt || Date.now(),
  }));
  if (item) {
    if (checked) { b.set(hh(s.hid!, "stock", item.id), stockAfter(s, item, qty)); pushEvent(s, b, item.id, qty, "achat"); }
    else if (prev?.addedToStock) {
      b.set(hh(s.hid!, "stock", item.id), stockAfter(s, item, -prev.addedToStock));
      const c = s.consumption.get(item.id);
      if (c) {
        const i = c.events.map((e) => e.type).lastIndexOf("achat");
        if (i >= 0) b.set(hh(s.hid!, "consumption", item.id), { events: c.events.filter((_, j) => j !== i) }, { merge: true });
      }
    }
  }
  await b.commit();
}

/** Prix payé saisi : prioritaire sur les prix relevés s'il est plus récent. */
export async function setPricePaid(s: StoreState, l: LineRef, price: number | null, store: StoreId) {
  await setDoc(hh(s.hid!, "shopping", l.id), { pricePaid: price, store }, { merge: true });
  const item = l.itemId ? s.idx.get(l.itemId) : undefined;
  if (item && price && price > 0) {
    const size = l.qty || item.packSize;
    await setDoc(hh(s.hid!, "paidPrices", `${item.id}_${store}`), { itemId: item.id, store, packPrice: price, packSize: size, pricePerUnit: price / size, date: ymd(today()) });
  }
}

export async function removeLine(s: StoreState, l: LineRef) {
  if (l.reason === "manuel") await deleteDoc(hh(s.hid!, "shopping", l.id));
  else await setDoc(hh(s.hid!, "shopping", l.id), clean({ id: l.id, itemId: l.itemId, name: l.name, qty: 0, unit: l.unit, reason: l.reason, category: l.category, checked: false, removed: true, addedAt: Date.now() }));
}
export const restoreLine = (s: StoreState, id: string) => deleteDoc(hh(s.hid!, "shopping", id));

/** Courses terminées : on vide les lignes cochées et les retraits. */
export async function finishShopping(s: StoreState) {
  const b = writeBatch(db);
  s.shopping.filter((d) => d.checked || d.removed).forEach((d) => b.delete(hh(s.hid!, "shopping", d.id)));
  await b.commit();
}

// ---------------- Ticket de caisse ----------------
export interface ReceiptLine { label: string; name: string; quantity: number; packSize: number | null; unit: "g" | "ml" | "pc" | null; totalPrice: number; itemId: string | null }
export const readReceiptFn = call<{ householdId: string; image: string; mediaType: string }, { store: string; date: string | null; lines: ReceiptLine[] }>("readReceipt");

export async function applyReceipt(s: StoreState, store: StoreId, date: string, lines: ReceiptLine[]) {
  const b = writeBatch(db);
  const stock = new Map(s.stock);
  for (const l of lines) {
    const item = l.itemId ? s.idx.get(l.itemId) : undefined;
    if (!item) continue;
    const size = l.packSize && l.unit === item.unit ? l.packSize : item.packSize;
    const qty = size * Math.max(1, l.quantity);
    const view = { ...s, stock } as StoreState;
    const entry = stockAfter(view, item, qty);
    stock.set(item.id, entry);
    b.set(hh(s.hid!, "stock", item.id), entry);
    pushEvent(s, b, item.id, qty, "achat");
    if (l.totalPrice > 0) {
      const packPrice = l.totalPrice / Math.max(1, l.quantity);
      b.set(hh(s.hid!, "paidPrices", `${item.id}_${store}`), { itemId: item.id, store, packPrice, packSize: size, pricePerUnit: packPrice / size, date });
    }
    // La ligne de courses correspondante est cochée.
    const line = s.shopping.find((d) => d.itemId === item.id && !d.checked);
    if (line) b.set(hh(s.hid!, "shopping", line.id), { checked: true, addedToStock: 0, pricePaid: l.totalPrice, store }, { merge: true });
  }
  await b.commit();
}

// ---------------- Plats perso ----------------
export const structureMyDish = call<{ householdId: string; name: string; persons: number; minutes: number; ingredients: string; steps: string }, { recipe: Recipe }>("structureMyDish");

/** Saisie libre : « 400 g de pâtes » → ingrédients reliés au catalogue (articles inconnus classés par l'IA). */
export async function saveManualDish(s: StoreState, f: { name: string; persons: number; minutes: number; ingredients: string; steps: string }) {
  const ing: Recipe["ingredients"] = [], meat: Recipe["meat"] = [];
  const unknown: string[] = [];
  for (const line of f.ingredients.split("\n")) {
    const p = parseLine(line);
    if (!p) continue;
    let item = s.idx.find(p.name);
    if (!item && s.online) { try { item = (await classifyFn({ name: p.name })).item; s.idx.add(item); } catch { /* ignoré */ } }
    if (!item) { unknown.push(p.name); continue; }
    let q = p.qty / f.persons;
    if (p.unit === "cs" || p.unit === "cc") { (item.category === "vi" ? meat : ing).push({ itemId: item.id, qtyPerPerson: q, spoon: p.unit }); continue; }
    if (!q) q = item.unit === "pc" ? 1 / f.persons : 0;
    if (p.unit && p.unit !== item.unit && item.unit === "pc") q = q / (item.packSize > 1 ? 100 : 1);
    (item.category === "vi" ? meat : ing).push({ itemId: item.id, qtyPerPerson: Math.round(q * 100) / 100 });
  }
  if (!ing.length && !meat.length) throw new Error("Ajoute des ingrédients, ou utilise ✨ l'IA.");
  const id = `perso-${slug(f.name)}-${Date.now().toString(36)}`;
  const r: Recipe = {
    id, name: f.name, vegName: meat.length ? `${f.name} (sans viande)` : null, seasons: ["P", "E", "A", "H"], prepMin: f.minutes,
    ingredients: ing, meat, vegSwap: [], steps: f.steps ? f.steps.split("\n").map((x) => x.trim()).filter(Boolean) : ["Préparer selon ta recette."],
    source: "perso", householdId: s.hid!, deleted: false, createdAt: Date.now(),
  };
  await setDoc(doc(db, "recipes", id), clean(r));
  return unknown;
}
export const deleteRecipe = (id: string) => updateDoc(doc(db, "recipes", id), { deleted: true });

// ---------------- Capteur de prix ----------------
export const extractPricesFn = call<{ store: StoreId; url: string; text: string }, { found: number; saved: { itemId: string; productName: string; packPrice: number }[]; created?: string[]; shop?: string | null; reader?: string }>("extractPrices");

// ---------- Goûts du foyer ----------
/** Enregistre la liste des profils et met à jour la composition du foyer (adultes, ados, enfants, végétariens). */
export async function savePeople(s: StoreState, people: Person[]) {
  await setDoc(hh(s.hid!, "meta", "tastes"), clean({ people }), { merge: true });
  if (!people.length) return;
  const e = eatersFromPeople(people);
  await saveSettings(s.hid!, { adults: Math.max(1, e.adults), teens: e.teens, kids: e.kids, persons: Math.max(1, e.adults) + e.teens + e.kids, vegEaters: e.vegEaters });
}
/** Avis d'un membre sur un plat (jeu « Ça te tente ? » ou note du lendemain). */
export const rateRecipe = (s: StoreState, personId: string, recipeId: string, rating: Rating) =>
  setDoc(hh(s.hid!, "meta", "tastes"), { ratings: { [personId]: { [recipeId]: rating } } }, { merge: true });

/** Accompagnement d'un repas de la semaine (null = celui d'origine du plat). */
/** Semaines déjà prévues : retire un accompagnement qui ne s'accorde plus au plat (règles de chef mises à jour) et en propose un juste. */
export async function fixSides(s: StoreState) {
  const slots = s.week?.slots || [];
  const all = [...s.recipes.values()];
  let changed = false;
  const cleaned = slots.map((sl) => {
    const r = s.recipes.get(sl.recipeId);
    if (!r || sl.cooked) return sl;
    const out = { ...sl };
    if (sl.side && !sideOptions(r, all, s.idx).some((x) => x.id === sl.side)) { delete out.side; changed = true; }
    if (sl.vegSide && !vegOptions(r, all, s.idx, sl.veg).some((x) => x.id === sl.vegSide)) { delete out.vegSide; changed = true; }
    return out;
  });
  if (changed) await saveSlots(s, assignSides(cleaned, s.recipes, s.idx, Math.random, s.prefs.sides, s.prefs.vegSides));
}

/** Déplace un repas vers un autre jour / moment ; s'il y a déjà un repas, les deux s'échangent. */
export async function moveSlot(s: StoreState, k: number, day: number, meal: Slot["meal"]) {
  const slots = [...(s.week?.slots || [])];
  const sl = slots[k];
  if (!sl) return;
  if (sl.fromLeftovers || sl.leftovers) throw new Error("Annule d'abord les restes de ce repas pour le déplacer.");
  const j = slots.findIndex((x, i) => i !== k && x.day === day && x.meal === meal);
  if (j >= 0 && (slots[j].fromLeftovers || slots[j].leftovers)) throw new Error("Ce moment contient des restes : choisis-en un autre.");
  if (j >= 0) slots[j] = { ...slots[j], day: sl.day, meal: sl.meal };
  slots[k] = { ...sl, day, meal };
  await saveSlots(s, sortSlots(slots));
}

/** Choisit le légume servi à côté d'un repas (ou celui de la recette) et retient l'accord pour ce plat. */
export async function setVegSide(s: StoreState, k: number, vegSide: string | null) {
  const slots = [...(s.week?.slots || [])];
  slots[k] = { ...slots[k], vegSide };
  await setDoc(hh(s.hid!, "weeks", s.weekKey), { slots }, { merge: true });
  await setDoc(hh(s.hid!, "meta", "prefs"), { vegSides: { [slots[k].recipeId]: vegSide } }, { merge: true });
}

/** Choisit l'accompagnement d'un repas et retient l'accord pour ce plat (proposé d'office les semaines suivantes). */
export async function setSide(s: StoreState, k: number, side: string | null) {
  const slots = [...(s.week?.slots || [])];
  slots[k] = { ...slots[k], side };
  await setDoc(hh(s.hid!, "weeks", s.weekKey), { slots }, { merge: true });
  await setDoc(hh(s.hid!, "meta", "prefs"), { sides: { [slots[k].recipeId]: side } }, { merge: true });
}
