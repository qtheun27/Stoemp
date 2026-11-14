export type StoreId = "colruyt" | "renmans" | "delhaize" | "carrefour" | "lidl" | "aldi" | "intermarche" | "ah";
export type Unit = "g" | "ml" | "pc";

/** Produit tel que lu chez une enseigne. */
export interface Product {
  id?: string;
  name: string;
  brand?: string | null;
  packSize: number | null;
  packUnit: Unit | null;
  price: number; // prix du paquet, ou prix au kilo/litre si packSize = 1000 et vendu au poids
  promo?: string | null;
  organic: boolean;
  url?: string;
}

/** Interface commune à tous les connecteurs. */
export interface Connector {
  store: StoreId;
  /** Rayons vendus (undefined = tous). */
  categories?: string[];
  search(query: string): Promise<Product[]>;
  close?(): Promise<void>;
}

export interface CatalogItem { id: string; name: string; aliases: string[]; category: string; unit: Unit; packSize: number; organicAvailable?: boolean }
