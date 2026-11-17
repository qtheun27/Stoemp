/**
 * Lecteur Colruyt sans IA : texte d'une page de catégorie ou de recherche (copié par le favori) → produits.
 * Format d'une fiche :
 *   [Action|Bio|Nouveau]
 *   BONI BIO Orange          ← nom
 *   1.5kg                    ← contenance (facultative)
 *   5 / 38 / /pce            ← prix : euros, centimes, unité de vente
 *   3,59/kg                  ← prix par unité de mesure
 *   [2 / 62 / /kg / àpd 4 pcs / 2,62/kg]  ← prix dégressif (facultatif)
 */
export interface ShopProduct {
  name: string;
  packSize: number; // dans packUnit
  packUnit: "g" | "ml" | "pc";
  price: number; // prix pour packSize
  pricePerUnit: number; // € par g, ml ou pièce
  promo: string | null;
  organic: boolean;
}

const TAGS = /^(action|bio|nouveau|nouveauté|promo|top|exclusif|-?\d+%|\d+\+\d+ gratuit.*)$/i;
const PACK = /^±?\s*(\d+(?:[.,]\d+)?)\s*(kg|g|gr|l|cl|ml|pc|pcs|pce|pièces?|st)$/i;
const MULTI = /^(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*(kg|g|l|cl|ml)$/i;
const RANGE = /^(\d+)\s*-\s*(\d+)\s*(pc|pcs|pce|pièces?|st)$/i;
const num = (s: string) => Number(s.replace(",", "."));

function pack(line: string): { size: number; unit: "g" | "ml" | "pc" } | null {
  const r = line.match(RANGE);
  if (r) return { size: (Number(r[1]) + Number(r[2])) / 2, unit: "pc" };
  const m = line.match(MULTI);
  if (m) { const one = metric(num(m[2]), m[3]); return one && { size: one.size * Number(m[1]), unit: one.unit }; }
  const p = line.match(PACK);
  return p ? metric(num(p[1]), p[2]) : null;
}
function metric(n: number, u: string): { size: number; unit: "g" | "ml" | "pc" } | null {
  switch (u.toLowerCase()) {
    case "kg": return { size: n * 1000, unit: "g" };
    case "g": case "gr": return { size: n, unit: "g" };
    case "l": return { size: n * 1000, unit: "ml" };
    case "cl": return { size: n * 10, unit: "ml" };
    case "ml": return { size: n, unit: "ml" };
    default: return { size: n, unit: "pc" };
  }
}

/** Magasin indiqué en haut de la page (« 403 produits à / Colruyt Basecles »). */
export function colruytShop(text: string): string | null {
  const m = text.match(/produits? à\s*\n\s*(Colruyt[^\n]+)/i) || text.match(/\n(Colruyt [A-ZÀ-Ü][^\n]{2,40})\n\s*Ouvert/);
  return m ? m[1].trim() : null;
}

export function parseColruyt(text: string): ShopProduct[] {
  const L = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const out: ShopProduct[] = [];
  const seen = new Set<string>();
  for (let i = 0; i + 3 < L.length; i++) {
    // Prix principal : euros / centimes / unité de vente, suivi du prix par unité de mesure.
    if (!/^\d{1,3}$/.test(L[i]) || !/^\d{2}$/.test(L[i + 1]) || !/^\/(kg|pce|pc|l|st)$/i.test(L[i + 2])) continue;
    const per = L[i + 3].match(/^(\d+,\d{2})\/(kg|pce|pc|l|st)$/i);
    if (!per) continue;
    // Ignore un prix dégressif (précédé d'un prix principal juste au-dessus).
    if (i >= 4 && /^\d+,\d{2}\/(kg|pce|pc|l|st)$/i.test(L[i - 1])) continue;
    const price = Number(L[i]) + Number(L[i + 1]) / 100;
    const saleUnit = L[i + 2].slice(1).toLowerCase();
    // Nom et contenance : on remonte au-dessus du prix.
    let j = i - 1;
    let pk = pack(L[j]);
    if (pk) j--;
    while (j >= 0 && TAGS.test(L[j])) j--;
    const name = L[j];
    if (!name || name.length < 3 || /^\d/.test(name) || /\/(kg|pce|l)$/i.test(name)) continue;
    const organic = /\bbio\b/i.test(name) || TAGS.test(L[j - 1] || "") && /^bio$/i.test(L[j - 1]);
    // Promo : prix d'alignement sur un concurrent, prix dégressif « àpd 4 pcs », ou bandeau « Action ».
    let promo: string | null = null;
    if (/^réaction promo concurrent$/i.test(L[i + 4] || "") && /^\d{1,3}$/.test(L[i + 5] || "") && /^\d{2,3}$/.test(L[i + 6] || "")) {
      const q = /àpd\s+\d+\s*\w*/i.exec(L[i + 8] || "")?.[0];
      promo = `Prix concurrent : ${L[i + 5]},${L[i + 6]} €${L[i + 7] || ""}${q ? " " + q : ""}`;
    } else {
      const after = L.slice(i + 4, i + 9).join(" ");
      promo = /àpd\s+\d+\s*\w*/i.exec(after)?.[0] || (/^action$/i.test(L[j - 1] || "") ? "Action" : null);
    }
    let size: number, unit: "g" | "ml" | "pc", total: number;
    if (saleUnit === "kg") { size = 1000; unit = "g"; total = price; }
    else if (saleUnit === "l") { size = 1000; unit = "ml"; total = price; }
    else if (pk && pk.size > 0) { size = pk.size; unit = pk.unit; total = price; }
    else { size = 1; unit = "pc"; total = price; }
    // « ±1kg » vendu au kilo : le prix affiché est déjà au kilo.
    if (pk && saleUnit === "kg") pk = null;
    const key = name + "|" + total;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, packSize: size, packUnit: unit, price: Math.round(total * 100) / 100, pricePerUnit: total / size, promo, organic });
  }
  return out;
}
