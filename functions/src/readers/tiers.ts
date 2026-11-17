/** Gammes et particularités des produits d'enseigne (pour choisir la variante adaptée à chaque foyer). */
export type Tier = "eco" | "maison" | "marque";
/** Gamme d'un produit d'après sa marque (premier prix, marque du magasin, grande marque). */
export function tierOf(store: string, name: string): Tier {
  const n = name.trim();
  const eco: Record<string, RegExp> = { colruyt: /^everyday\b/i, delhaize: /^365\b/i, carrefour: /^(simpl|carrefour classic)\b/i, ah: /^ah basic\b/i };
  const house: Record<string, RegExp> = { colruyt: /^boni\b/i, delhaize: /^delhaize\b/i, carrefour: /^carrefour\b/i, ah: /^ah\b/i, renmans: /^renmans\b/i };
  if (eco[store]?.test(n)) return "eco";
  if (house[store]?.test(n)) return "maison";
  // Produit en vrac sans marque (« carottes ») : gamme du magasin ; marque en capitales en tête (« PAPILLON bananes ») : grande marque.
  return /^[A-ZÀ-Ü0-9'’&.-]{3,}\b/.test(n) && !/^(BIO|BONI)\b/.test(n) ? "marque" : "maison";
}
export const tagsOf = (name: string) => [
  /sans gluten|gluten[- ]?free|glutenvrij/i.test(name) && "sans-gluten",
  /sans lactose|lactose[- ]?free|lactosevrij/i.test(name) && "sans-lactose",
  /vegan|végétal|vegetal|plan'?t\b|plant[- ]based/i.test(name) && "vegetal",
].filter(Boolean) as string[];

