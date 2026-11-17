import type { Course, Cuisine, Allergen, Cat, Location, Season, StoreId } from "./types";

export const CATS: Record<Cat, { label: string; icon: string }> = {
  fl: { label: "Fruits & légumes", icon: "🥕" },
  vi: { label: "Boucherie & poisson", icon: "🥩" },
  fr: { label: "Frais & crèmerie", icon: "🥛" },
  bo: { label: "Boulangerie", icon: "🥖" },
  ep: { label: "Épicerie", icon: "🥫" },
  bs: { label: "Boissons", icon: "🥤" },
  su: { label: "Surgelés", icon: "❄️" },
  dr: { label: "Hygiène & entretien", icon: "🧴" },
};
export const CAT_ORDER: Cat[] = ["fl", "vi", "fr", "bo", "ep", "bs", "su", "dr"];

export const SEASONS: Record<Season, { label: string; icon: string; produce: string }> = {
  P: { label: "Printemps", icon: "🌱", produce: "Asperges, radis, petits pois, épinards, carottes nouvelles" },
  E: { label: "Été", icon: "☀️", produce: "Tomates, courgettes, aubergines, poivrons, concombres" },
  A: { label: "Automne", icon: "🍂", produce: "Potiron, champignons, chou-fleur, poireaux, patate douce" },
  H: { label: "Hiver", icon: "❄️", produce: "Chicons, chou, poireaux, carottes, céleri, oignons" },
};
export const SEASON_ORDER: Season[] = ["P", "E", "A", "H"];

export const ALLERGENS: Record<Allergen, string> = {
  gl: "Gluten", la: "Lait", oe: "Œufs", po: "Poisson", fc: "Fruits à coque", so: "Soja", cr: "Crustacés",
};

export const STORES: Record<StoreId, { label: string; color: string; online: boolean; factor: number; only?: string[] }> = {
  colruyt: { label: "Colruyt", color: "#E2001A", online: true, factor: 1 },
  renmans: { label: "Renmans", color: "#B3121E", online: true, factor: 1.05, only: ["vi"] },
  delhaize: { label: "Delhaize", color: "#D7182A", online: true, factor: 1.12 },
  carrefour: { label: "Carrefour", color: "#1E4FA0", online: true, factor: 1.08 },
  lidl: { label: "Lidl", color: "#0050AA", online: false, factor: 0.93 },
  aldi: { label: "Aldi", color: "#00005F", online: false, factor: 0.92 },
  intermarche: { label: "Intermarché", color: "#E30613", online: false, factor: 1.1 },
  ah: { label: "Albert Heijn", color: "#00A0E2", online: true, factor: 1.04 },
};
export const STORE_ORDER = Object.keys(STORES) as StoreId[];

export const LOCATIONS: Record<Location, { label: string; icon: string }> = {
  frigo: { label: "Frigo", icon: "🧊" },
  congelateur: { label: "Congélateur", icon: "❄️" },
  placard: { label: "Placard", icon: "🗄️" },
  cave: { label: "Cave", icon: "🍷" },
  "salle-de-bain": { label: "Salle de bain", icon: "🛁" },
};

export const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const WEEKDAYS_SUN0 = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

/** Cuisines des recettes, dans l'ordre d'affichage. */
export const CUISINES: Record<Cuisine, { label: string; icon: string }> = {
  belge: { label: "Belge", icon: "🇧🇪" }, francaise: { label: "Française", icon: "🥖" }, italienne: { label: "Italienne", icon: "🍝" },
  mediterraneenne: { label: "Méditerranéenne", icon: "🫒" }, orientale: { label: "Orientale", icon: "🧆" }, asiatique: { label: "Asiatique", icon: "🥢" },
  indienne: { label: "Indienne", icon: "🍛" }, latino: { label: "Mexicaine & latino", icon: "🌮" }, americaine: { label: "Américaine", icon: "🍔" },
};
export const CUISINE_ORDER = Object.keys(CUISINES) as Cuisine[];

/** Types de plats de la bibliothèque, dans l'ordre d'un repas. */
export const COURSES: Record<Course, { label: string; icon: string }> = {
  aperitif: { label: "Apéritifs", icon: "🫒" }, entree: { label: "Entrées", icon: "🥗" }, soupe: { label: "Soupes", icon: "🍲" },
  plat: { label: "Plats", icon: "🍽️" }, accompagnement: { label: "Accompagnements", icon: "🥔" }, dessert: { label: "Desserts", icon: "🍰" },
  patisserie: { label: "Pâtisseries & goûters", icon: "🥐" }, petitdej: { label: "Petit-déjeuner & brunch", icon: "☕" },
};
export const COURSE_ORDER = Object.keys(COURSES) as Course[];
