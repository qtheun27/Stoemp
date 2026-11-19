import { slotRecipe } from "./sides";
import { ingredientsOf, type ItemIndex } from "./catalog";
import { predict, shouldAutoAdd } from "./predict";
import type { Cat, Consumption, Reason, Recipe, ShoppingDoc, Slot, StockEntry, Unit } from "./types";
import { baseQty, packsFor } from "./units";
import { coursePortions, slotPortions } from "./household";
import { mealParts, vegPortions } from "./mixed";

export interface ShopLine {
  id: string;
  itemId: string | null;
  name: string;
  /** quantité nécessaire (unité de l'article) */
  need: number;
  /** quantité à acheter, arrondie aux formats vendus */
  qty: number;
  unit: Unit | "";
  packs: number;
  reason: Reason;
  category: Cat;
  checked: boolean;
  pricePaid?: number | null;
  store?: string | null;
  detail?: string;
}

export interface ShopInput {
  slots: Slot[];
  recipes: Map<string, Recipe>;
  persons: number;
  idx: ItemIndex;
  stock: Map<string, StockEntry>;
  consumption: Map<string, Consumption>;
  docs: ShoppingDoc[];
  nextShopping: Date;
  packSizeOf?: (itemId: string) => number;
  /** Foyer mixte : végétariens du foyer, et allergies (pour la protéine végé ajoutée). */
  vegEaters?: number;
  allergens?: string[];
}

/** Besoins des repas non cuisinés, par article (unité de l'article). */
export function mealNeeds(slots: Slot[], recipes: Map<string, Recipe>, persons: number, idx: ItemIndex, vegEaters = 0, allergens: string[] = []) {
  const need = new Map<string, number>();
  const add = (ings: ReturnType<typeof ingredientsOf>, portions: number) => {
    if (portions <= 0) return;
    for (const ing of ings) {
      const item = idx.get(ing.itemId);
      if (!item) continue;
      need.set(item.id, (need.get(item.id) || 0) + baseQty(ing, item) * portions);
    }
  };
  for (const s of slots) {
    if (s.cooked) continue;
    const r = slotRecipe(recipes, s, idx);
    // Plat (+ invités, + restes du lendemain) ; foyer mixte : parts avec viande et parts végé du même plat.
    if (r) { const P = slotPortions(s, persons); for (const p of mealParts(r, s.veg, P, vegPortions(s, { vegEaters }, persons), allergens)) add(p.ings, p.portions); }
    for (const c of s.courses || []) { const cr = recipes.get(c.recipeId); if (cr) add(ingredientsOf(cr, false), coursePortions(s, persons)); } // apéritif, entrée, dessert
  }
  return need;
}

/**
 * Liste de courses = besoins des repas − stock, + ruptures prévues avant les prochaines courses (+2 j),
 * + stock sous le minimum, + ajouts manuels. Les documents enregistrés gardent l'état (coché, retiré, prix payé).
 */
export function buildShopping(inp: ShopInput): { lines: ShopLine[]; suggestions: { itemId: string; runOut: Date }[] } {
  const { idx, stock, docs } = inp;
  const docById = new Map(docs.map((d) => [d.id, d]));
  const pack = (id: string) => inp.packSizeOf?.(id) || idx.get(id)?.packSize || 1;
  const lines: ShopLine[] = [];
  const seen = new Set<string>();

  const push = (l: ShopLine) => {
    const d = docById.get(l.id);
    if (d?.removed) return;
    if (d) { l.checked = d.checked; l.pricePaid = d.pricePaid; l.store = d.store; if (d.checked && d.addedToStock) l.qty = d.addedToStock; }
    lines.push(l);
    if (l.itemId) seen.add(l.itemId);
  };

  // 1. Repas
  for (const [itemId, need] of mealNeeds(inp.slots, inp.recipes, inp.persons, idx, inp.vegEaters, inp.allergens)) {
    const item = idx.get(itemId)!;
    const s = stock.get(itemId);
    const doc = docById.get("auto_" + itemId);
    // Un fond de placard sans fiche de stock est supposé présent.
    if (item.staple && !s) continue;
    // Une fois coché, le stock contient déjà l'achat : on garde la ligne cochée telle quelle.
    const have = doc?.checked ? Math.max(0, (s?.qty || 0) - (doc.addedToStock || 0)) : s?.qty || 0;
    const deficit = need - have;
    if (deficit <= 0.0001) continue;
    const packs = packsFor(deficit, pack(itemId));
    push({ id: "auto_" + itemId, itemId, name: item.name, need: deficit, qty: packs * pack(itemId), unit: item.unit, packs, reason: "repas", category: item.category, checked: false });
  }

  // 2. Stock bas ou rupture prévue
  const suggestions: { itemId: string; runOut: Date }[] = [];
  const candidates = new Set([...stock.keys(), ...inp.consumption.keys()]);
  for (const itemId of candidates) {
    if (seen.has(itemId)) continue;
    const item = idx.get(itemId);
    if (!item) continue;
    const s = stock.get(itemId);
    const qty = s?.qty || 0;
    const low = s?.minQty != null && qty < s.minQty;
    const c = inp.consumption.get(itemId);
    const p = c ? predict(c.events, qty, c.rateFactor) : null;
    const decision = p ? shouldAutoAdd(p, inp.nextShopping) : null;
    if (low || decision === "auto") {
      const pk = pack(itemId);
      push({ id: "auto_" + itemId, itemId, name: item.name, need: pk, qty: pk, unit: item.unit, packs: 1, reason: "stock", category: item.category, checked: false,
        detail: low ? "sous le minimum" : `rupture prévue le ${p!.nextRunOut!.toLocaleDateString("fr-BE", { day: "numeric", month: "short" })}` });
    } else if (decision === "suggest" && p?.nextRunOut) suggestions.push({ itemId, runOut: p.nextRunOut });
  }

  // 3. Ajouts manuels
  for (const d of docs) {
    if (d.reason !== "manuel" || d.removed) continue;
    lines.push({ id: d.id, itemId: d.itemId || null, name: d.name, need: d.qty, qty: d.qty, unit: d.unit, packs: 1, reason: "manuel", category: d.category, checked: d.checked, pricePaid: d.pricePaid, store: d.store });
  }
  return { lines, suggestions };
}

/** Texte partageable, rangé par rayon. */
export function shareText(lines: ShopLine[], fmt: (l: ShopLine) => string, cats: Record<Cat, { label: string; icon: string }>, order: Cat[], isReady: (l: ShopLine) => boolean = () => false) {
  let t = "🛒 Liste de courses — Stoemp\n";
  const ready = lines.filter((l) => isReady(l) && !l.checked);
  if (ready.length) t += `\n🥡 Plats préparés\n` + ready.map((l) => `• ${l.name}${fmt(l) ? " — " + fmt(l) : ""}`).join("\n") + "\n";
  for (const c of order) {
    const L = lines.filter((l) => l.category === c && !l.checked && !isReady(l));
    if (!L.length) continue;
    t += `\n${cats[c].icon} ${cats[c].label}\n` + L.map((l) => `• ${l.name}${fmt(l) ? " — " + fmt(l) : ""}`).join("\n") + "\n";
  }
  return t;
}
