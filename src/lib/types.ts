export type { Cuisine } from "../data/recipes-more";
import type { Cuisine } from "../data/recipes-more";
export type Cat = "fl" | "vi" | "fr" | "bo" | "ep" | "bs" | "su" | "dr";
export type Unit = "g" | "ml" | "pc";
export type Season = "P" | "E" | "A" | "H";
export type Allergen = "gl" | "la" | "oe" | "po" | "fc" | "so" | "cr";
export type StoreId = "colruyt" | "renmans" | "delhaize" | "carrefour" | "lidl" | "aldi" | "intermarche" | "ah";
export type Location = "frigo" | "congelateur" | "placard" | "cave" | "salle-de-bain";

export interface Item {
  id: string;
  name: string;
  aliases: string[];
  category: Cat;
  unit: Unit;
  local: boolean;
  organicAvailable: boolean;
  seasonMonths: number[];
  perishable: boolean;
  shelfLifeDays: number;
  staple: boolean;
  common: boolean;
  allergens: Allergen[];
  packSize: number;
  demoPrice: number;
  source?: "base" | "ia";
  /** Plat préparé vendu en magasin (lasagne, pizza…), à part des ingrédients. */
  ready?: boolean;
}

export interface Ingredient {
  itemId: string;
  /** quantité pour 1 personne, dans l'unité de l'article (ou en c. à s. / c. à c. si `spoon`) */
  qtyPerPerson: number;
  spoon?: "cs" | "cc";
}

export interface Recipe {
  id: string;
  name: string;
  vegName: string | null;
  seasons: Season[];
  prepMin: number;
  ingredients: Ingredient[];
  meat: Ingredient[];
  vegSwap: Ingredient[];
  steps: string[];
  /** « pret » : plat préparé du magasin, à réchauffer (créé à partir du catalogue). */
  source: "base" | "ia" | "perso" | "pret";
  /** Cuisine (belge, italienne, asiatique…). */
  cuisine?: Cuisine;
  householdId?: string;
  deleted?: boolean;
  createdAt?: number;
}

/** Gamme de produits du foyer : premier prix, marque du magasin, ou grandes marques. */
export type PriceRange = "eco" | "maison" | "marque";

export interface GenOptions {
  seasonal: boolean;
  season: Season | "auto";
  local: boolean;
  organic: boolean;
  veg: boolean;
  budgetOn: boolean;
  budget: number;
  timeOn: boolean;
  maxTime: 20 | 30 | 45;
  allergens: Allergen[];
  avoid: string[];
  favorites: boolean;
  ai: boolean;
  useStock: boolean;
  range: PriceRange;
  /** Plats appréciés des enfants (pas trop épicés). */
  kidFriendly?: boolean;
  /** Boissons conseillées avec les repas. */
  drinks?: boolean;
  /** Pas d'alcool dans les suggestions de boissons. */
  noAlcohol?: boolean;
  /** Favoriser les recettes dont les ingrédients sont en promo. */
  promos?: boolean;
  /** Semaine équilibrée (poisson, légumineuses, variété des féculents). */
  balance?: boolean;
  /** Cuisines préférées : elles reviennent plus souvent (vide = toutes). */
  cuisines?: Cuisine[];
}

export interface Settings {
  /** Nombre total de personnes (gardé pour compatibilité ; voir adults/teens/kids). */
  persons: number;
  adults?: number;
  teens?: number; // 11-17 ans : portion entière
  kids?: number; // 3-10 ans : demi-portion environ
  /** Nombre de repas de midi (0 à 7) et du soir (0 à 7) par semaine. */
  lunches: number;
  dinners: number;
  /** Ancien réglage (7 ou 14 repas), lu seulement si lunches/dinners manquent. */
  mealsPerDay?: 1 | 2;
  mineN: number;
  /** Foyer mixte : nombre de végétariens (le reste mange la version avec viande du même plat). */
  vegEaters?: number;
  options: GenOptions;
  stores: StoreId[];
  preferredStore: StoreId | "cheapest";
  /** Magasin habituel par enseigne (ex. « Colruyt Basecles », « Carrefour Market Mons »). */
  shops?: Partial<Record<StoreId, string>>;
  myColruytStore?: string;
  renmansShop?: string;
  /** jours de courses : 0 = dimanche … 6 = samedi */
  shoppingDays: number[];
}

export interface Slot {
  day: number; // 0 = lundi
  meal: "midi" | "soir";
  recipeId: string;
  veg: boolean;
  cooked: boolean;
  /** Réception : invités en plus du foyer, autres plats du menu, boissons conseillées. */
  guests?: { adults: number; kids: number } | null;
  courses?: { type: "aperitif" | "entree" | "dessert"; recipeId: string }[] | null;
  drinks?: string[] | null;
  /** Cuisiner aussi pour le lendemain midi. */
  leftovers?: boolean;
  /** Ce repas = les restes de la veille (pas de courses). */
  fromLeftovers?: boolean;
  /** Créneau ajouté pour accueillir les restes (retiré si on annule). */
  addedForLeftovers?: boolean;
  /** Plat prévu avant d'être remplacé par les restes (rétabli si on annule). */
  prevRecipeId?: string | null;
}

export interface StockEntry {
  qty: number;
  unit: Unit;
  location: Location;
  expiresAt?: string | null;
  minQty?: number | null;
  updatedAt: number;
}

export type EventType = "achat" | "repas" | "manuel" | "jeté";
export interface ConsumptionEvent { date: string; qty: number; type: EventType }
export interface Consumption {
  events: ConsumptionEvent[];
  dailyRate: number;
  rateConfidence: "aucune" | "faible" | "moyenne" | "haute";
  nextRunOut: string | null;
  rateFactor?: number;
}

export type Reason = "repas" | "stock" | "manuel";
export interface ShoppingDoc {
  id: string;
  itemId?: string | null;
  name: string;
  qty: number;
  unit: Unit | "";
  reason: Reason;
  category: Cat;
  store?: StoreId | null;
  checked: boolean;
  pricePaid?: number | null;
  removed?: boolean;
  addedToStock?: number;
  addedAt: number;
}

export interface Price {
  itemId: string;
  store: StoreId;
  organic: boolean;
  productName: string;
  url?: string;
  packSize: number;
  packUnit: Unit;
  packPrice: number;
  pricePerUnit: number;
  promo?: string | null;
  promoUntil?: string | null;
  fetchedAt: string;
  source: "robot" | "capture" | "ticket" | "openprices" | "manuel";
  shop?: string | null;
  /** Variantes relevées pour cet article dans cette enseigne (gamme, bio, sans gluten…). */
  offers?: Offer[];
}

export interface Offer {
  name: string;
  tier: PriceRange;
  organic: boolean;
  tags: string[]; // "sans-gluten", "sans-lactose", "vegetal"
  size: number; // dans l'unité de l'article
  price: number;
  ppu: number;
  promo?: string | null;
}

export interface PaidPrice {
  itemId: string;
  store: StoreId;
  packPrice: number;
  packSize: number;
  pricePerUnit: number;
  date: string;
}
