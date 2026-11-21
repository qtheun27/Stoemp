// Présentation courte d'un plat, sans IA : cuisine et type de plat, ingrédients qui le font, accompagnement, durée.
// Une recette peut aussi porter sa propre description (`desc`, plats perso), qui passe avant.
import { CUISINES } from "./constants";
import type { ItemIndex } from "./catalog";
import type { Recipe } from "./types";

const COURSE: Record<string, string> = { aperitif: "Apéritif", entree: "Entrée", soupe: "Soupe", plat: "Plat", accompagnement: "Accompagnement", dessert: "Dessert", patisserie: "Pâtisserie", petitdej: "Petit-déjeuner" };
const SKIP = /^(sel|poivre|eau|huile|huile d'olive|beurre|sucre|farine|ail|bouillon)/i;

export function describeDish(r: Recipe, idx: ItemIndex, veg = false): string {
  if (r.desc) return r.desc;
  const ings = [...(veg ? r.vegSwap : r.meat), ...r.ingredients]
    .map((g) => ({ it: idx.get(g.itemId), q: g.spoon ? 0 : g.qtyPerPerson }))
    .filter((x) => x.it && !x.it.staple && !SKIP.test(x.it.name))
    // Viande ou poisson d'abord, puis les ingrédients les plus présents (en poids ou en volume).
    .sort((a, b) => Number(b.it!.category === "vi") - Number(a.it!.category === "vi") || (b.it!.unit === "pc" ? b.q * 100 : b.q) - (a.it!.unit === "pc" ? a.q * 100 : a.q));
  const names = [...new Set(ings.map((x) => x.it!.name.toLowerCase()))].slice(0, 4);
  const kind = `${COURSE[r.course || "plat"] || "Plat"}${r.light ? " léger" : ""}${r.cuisine && CUISINES[r.cuisine] ? ` de cuisine ${CUISINES[r.cuisine].label.toLowerCase()}` : ""}`;
  const side = r.sideName || r.sideLabel;
  return `${kind}${names.length ? ` : ${names.join(", ")}` : ""}${side ? ` · servi avec ${side.toLowerCase()}` : ""}.`;
}
