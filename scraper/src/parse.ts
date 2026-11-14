import type { Product, Unit } from "./types.js";

export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/\s+/g, " ").trim();
export const parsePrice = (s: string): number | null => {
  const m = s.replace(/\s/g, "").match(/(\d+)[,.](\d{2})/);
  return m ? Number(`${m[1]}.${m[2]}`) : null;
};

/** « 500 g », « 1,5 kg », « 6 x 1,5 l », « 75 cl », « 12 rouleaux » → contenance dans l'unité métrique. */
export function parsePack(s: string): { size: number; unit: Unit } | null {
  const t = norm(s).replace(",", ".");
  const multi = t.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|l|cl|ml)\b/);
  if (multi) { const one = toMetric(Number(multi[2]), multi[3]); return one && { size: one.size * Number(multi[1]), unit: one.unit }; }
  const m = t.match(/(\d+(?:\.\d+)?)\s*(kg|gr|g|l|cl|dl|ml)\b/);
  if (m) return toMetric(Number(m[1]), m[2]);
  const pc = t.match(/(\d+)\s*(pieces?|pcs?|st|rouleaux|sachets|capsules|tranches|oeufs)\b/);
  if (pc) return { size: Number(pc[1]), unit: "pc" };
  return null;
}
function toMetric(n: number, u: string): { size: number; unit: Unit } | null {
  switch (u) {
    case "kg": return { size: n * 1000, unit: "g" };
    case "g": case "gr": return { size: n, unit: "g" };
    case "l": return { size: n * 1000, unit: "ml" };
    case "cl": return { size: n * 10, unit: "ml" };
    case "dl": return { size: n * 100, unit: "ml" };
    case "ml": return { size: n, unit: "ml" };
  }
  return null;
}

/** Prix au kilo ou au litre affiché (« 4,98 €/kg ») → produit vendu au poids. */
export function perKilo(text: string): { price: number; unit: Unit } | null {
  const m = norm(text).replace(/\s/g, "").match(/(?:€)?(\d+[,.]\d{2})(?:€)?\/(kg|l)/);
  return m ? { price: Number(m[1].replace(",", ".")), unit: m[2] === "kg" ? "g" : "ml" } : null;
}

export const isOrganic = (name: string) => /\bbio\b|biologique|organic/i.test(name);

/** Extraction générique depuis les blocs JSON-LD schema.org (Product / ItemList). */
export function fromJsonLd(blocks: string[], baseUrl: string): Product[] {
  const out: Product[] = [];
  const visit = (o: unknown): void => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) { o.forEach(visit); return; }
    const x = o as Record<string, unknown>;
    if (x["@type"] === "Product") {
      const offers = (Array.isArray(x.offers) ? x.offers[0] : x.offers) as Record<string, unknown> | undefined;
      const price = Number(offers?.price ?? offers?.lowPrice);
      const name = String(x.name || "");
      const pack = parsePack(name + " " + String(x.weight || x.size || ""));
      if (name && price > 0) out.push({ name, brand: (x.brand as { name?: string })?.name || null, price, packSize: pack?.size ?? null, packUnit: pack?.unit ?? null, organic: isOrganic(name), url: String(x.url || baseUrl) });
    }
    Object.values(x).forEach(visit);
  };
  for (const b of blocks) { try { visit(JSON.parse(b)); } catch { /* bloc invalide */ } }
  return out;
}
