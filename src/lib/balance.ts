import { ingredientsOf, type ItemIndex } from "./catalog";
import type { Recipe } from "./types";

export type Protein = "poisson" | "viande" | "legumineuses" | "vege";
export type Starch = "pates" | "riz" | "pdt" | "pain" | "cereales" | "autre";

const LEGUMES_SECS = ["lentilles", "pois-chiches", "haricots-rouges", "haricots-blancs", "falafels"];

/** Profil d'un repas : protéine principale et féculent (pour équilibrer la semaine). */
export function profile(r: Recipe, veg: boolean, idx: ItemIndex): { protein: Protein; starch: Starch } {
  const ids = ingredientsOf(r, veg).map((i) => i.itemId);
  const has = (...k: string[]) => ids.some((id) => k.some((x) => id.includes(x)));
  const protein: Protein = ids.some((id) => idx.get(id)?.allergens.includes("po")) || has("scampi", "moules") ? "poisson"
    : !veg && r.meat.length ? "viande" : has(...LEGUMES_SECS) ? "legumineuses" : "vege";
  const starch: Starch = has("pates", "spaghetti", "nouilles", "lasagne", "gnocchi") ? "pates" : has("riz") ? "riz"
    : has("pomme-de-terre", "pommes-de-terre", "frites", "patate") ? "pdt" : has("pain", "baguette", "tortilla", "pita") ? "pain"
    : has("semoule", "boulgour", "quinoa") ? "cereales" : "autre";
  return { protein, starch };
}

export const PROTEIN_LABEL: Record<Protein, string> = { poisson: "🐟 poisson", viande: "🥩 viande", legumineuses: "🫘 légumineuses", vege: "🥕 végé" };

/** Féculents et bases qui rassasient : un plat principal complet en contient un (repas léger mis à part). */
export const STARCH_RE = /farine|pomme(s)? de terre|grenaille|frite|croquette|pur[ée]e|riz|p[âa]tes|spaghetti|tagliatelle|penne|linguine|macaroni|lasagne|cannelloni|gnocchi|nouille|ramen|udon|vermicelle|semoule|couscous|boulgour|quinoa|polenta|pain|baguette|pistolet|toast|tortilla|wrap|pita|naan|galette|cr[êe]pe|p[âa]te (feuillet|bris|à pizza)|pizza|patate douce|lentille|pois chiche|haricots? (rouges?|blancs?|noirs?)|ma[ïi]s|feuilles de lasagne|croûton/i;
export const hasStarch = (r: Recipe, idx: ItemIndex) => [...r.ingredients, ...r.meat].some((i) => STARCH_RE.test(idx.get(i.itemId)?.name || ""));
