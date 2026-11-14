import { pause, searchPage } from "../browser.js";
import type { Connector, StoreId } from "../types.js";

/**
 * Connecteurs « boutique en ligne » : page de recherche de l'enseigne, produits lus dans les réponses JSON
 * qu'elle charge elle-même et dans le JSON-LD. Si le site bloque les robots, le connecteur échoue proprement
 * et l'appli garde les derniers prix connus (ou ceux du capteur et des tickets).
 */
function web(store: StoreId, url: (q: string) => string, apiHint: RegExp, categories?: string[]): Connector {
  return { store, categories, async search(q) { const r = await searchPage(url(encodeURIComponent(q)), apiHint); await pause(); return r; } };
}

export const colruyt = (placeId?: string) =>
  web("colruyt", (q) => `https://www.colruyt.be/fr/produits?searchTerm=${q}${placeId ? `&placeId=${placeId}` : ""}`, /product|search|article/i);
export const delhaize = () => web("delhaize", (q) => `https://www.delhaize.be/fr/search?q=${q}`, /graphql|search|product/i);
export const carrefour = () => web("carrefour", (q) => `https://www.carrefour.be/fr/search?q=${q}`, /search|product/i);
export const albertHeijn = () => web("ah", (q) => `https://www.ah.be/zoeken?query=${q}`, /graphql|search|product/i);
