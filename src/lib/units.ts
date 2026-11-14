import type { Ingredient, Item, Unit } from "./types";

/** Quantité d'un ingrédient pour 1 personne, convertie dans l'unité de l'article. */
export function baseQty(ing: Ingredient, item: Item): number {
  if (!ing.spoon) return ing.qtyPerPerson;
  const ml = ing.qtyPerPerson * (ing.spoon === "cs" ? 15 : 5);
  if (item.unit === "pc") return ml / 100; // rare : une cuillère d'un produit compté en pièces
  return ml; // 1 ml ≈ 1 g pour sauces et épices
}

const half = (q: number) => { const x = Math.ceil(q * 2) / 2; const w = Math.floor(x); return (w || "") + (x % 1 ? "½" : "") || "½"; };

/** Affichage lisible : 350 g, 1,2 kg, 1,5 L, × 2½, 1 c. à s. */
export function fmtQty(q: number, unit: Unit | "cs" | "cc" | ""): string {
  if (!unit) return "";
  if (unit === "cs") return `${half(q)} c. à s.`;
  if (unit === "cc") return `${half(q)} c. à c.`;
  if (unit === "pc") return `× ${half(q)}`;
  const x = q >= 100 ? Math.round(q / 10) * 10 : Math.max(5, Math.round(q / 5) * 5);
  if (x >= 1000) return (x / 1000).toLocaleString("fr-BE", { maximumFractionDigits: 1 }) + (unit === "g" ? " kg" : " L");
  return `${x} ${unit}`;
}

/** Affichage d'un ingrédient de recette pour n personnes. */
export const fmtIngredient = (ing: Ingredient, item: Item, persons: number) =>
  ing.spoon ? fmtQty(ing.qtyPerPerson * persons, ing.spoon) : fmtQty(ing.qtyPerPerson * persons, item.unit);

/** Arrondit au nombre de paquets entiers. */
export const packsFor = (qty: number, packSize: number) => (qty <= 0 ? 0 : Math.max(1, Math.ceil(qty / packSize - 1e-9)));
