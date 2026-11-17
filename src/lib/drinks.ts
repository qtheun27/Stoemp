import { ingredientsOf, type ItemIndex } from "./catalog";
import type { Recipe } from "./types";

export interface DrinkSuggestion { adult: string; adultItem: string; kid: string; kidItem: string }

const has = (ids: string[], ...keys: string[]) => ids.some((id) => keys.some((k) => id.includes(k)));

/** Accord boisson simple, d'après les ingrédients du plat (sans IA). */
export function drinkFor(r: Recipe, veg: boolean, idx: ItemIndex, noAlcohol = false): DrinkSuggestion {
  const ids = ingredientsOf(r, veg).map((i) => i.itemId);
  const fish = ids.some((id) => idx.get(id)?.allergens.includes("po")) || has(ids, "moules", "scampi");
  const kid = { kid: "Jus de pomme ou eau pétillante", kidItem: "jus-de-pomme" };
  if (noAlcohol) {
    if (fish) return { adult: "Eau pétillante citronnée", adultItem: "eau-petillante", ...kid };
    return { adult: "Jus de pomme pétillant ou thé glacé maison", adultItem: "jus-de-pomme", ...kid };
  }
  if (has(ids, "biere-brune", "pain-d-epices") || /carbonnade|stoemp|liégeoise|liegeoise|waterzooi|chicons/i.test(r.name))
    return { adult: "Bière belge (brune ou d'abbaye)", adultItem: "biere-brune", ...kid };
  if (has(ids, "moules")) return { adult: "Bière blanche ou vin blanc sec", adultItem: "vin-blanc", ...kid };
  if (fish) return { adult: "Vin blanc sec (Muscadet, Sauvignon)", adultItem: "vin-blanc", ...kid };
  if (has(ids, "chili", "curry", "fajitas", "piment")) return { adult: "Bière blonde bien fraîche", adultItem: "biere-blonde", ...kid };
  if (!veg && has(ids, "boeuf", "agneau", "hache-de-boeuf", "steak", "cotelettes")) return { adult: "Vin rouge (Côtes-du-Rhône, Bordeaux)", adultItem: "vin-rouge", ...kid };
  if (!veg && has(ids, "poulet", "dinde", "porc", "lardons", "jambon", "saucisse")) return { adult: "Vin blanc léger ou bière blonde", adultItem: "vin-blanc", ...kid };
  if (has(ids, "fromage", "reblochon", "comte", "raclette")) return { adult: "Vin blanc de Savoie ou bière d'abbaye", adultItem: "vin-blanc", ...kid };
  return { adult: "Vin rouge léger ou eau pétillante", adultItem: "vin-rouge", ...kid };
}
