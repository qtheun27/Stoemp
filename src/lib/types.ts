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
  source: "base" | "ia" | "perso";
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
}

export interface Settings {
  persons: number;
  mealsPerDay: 1 | 2;
  mineN: number;
  options: GenOptions;
  stores: StoreId[];
  preferredStore: StoreId | "cheapest";
  myColruytStore: string;
  renmansShop: string;
  /** jours de courses : 0 = dimanche … 6 = samedi */
  shoppingDays: number[];
}

export interface Slot {
  day: number; // 0 = lundi
  meal: "midi" | "soir";
  recipeId: string;
  veg: boolean;
  cooked: boolean;
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
