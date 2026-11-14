import { donePage, newPage, pause } from "../browser.js";
import { isOrganic, norm, parsePack, perKilo, parsePrice } from "../parse.js";
import type { Connector, Product } from "../types.js";

const BASE = "https://www.renmans.be";
// Rayons du catalogue Renmans utiles au foyer (boucherie, volaille, charcuterie, traiteur).
const CATEGORIES = ["viandes", "volailles", "hache-saucisses-hamburgers", "viandes-preparees", "charcuterie", "barbecue"];

/**
 * Renmans : le catalogue public affiche le prix au kilo (ou à la pièce) sur chaque fiche produit.
 * On parcourt les rayons une fois par passe, puis la recherche filtre ce catalogue en mémoire.
 */
export function renmans(): Connector {
  let catalog: Product[] | null = null;
  async function load(): Promise<Product[]> {
    if (catalog) return catalog;
    const page = await newPage();
    const links = new Set<string>();
    try {
      for (const c of CATEGORIES) {
        await page.goto(`${BASE}/fr/produits/${c}`, { timeout: 45_000 });
        const subs = await page.$$eval("a", (as) => as.map((a) => (a as HTMLAnchorElement).href));
        for (const h of subs) if (/\/fr\/produits\/[^/#]+\/[^/#]+\/[^/#]+$/.test(h)) links.add(h);
        for (const sub of [...new Set(subs.filter((h) => new RegExp(`/fr/produits/${c}/[^/#]+$`).test(h)))]) {
          await pause();
          await page.goto(sub, { timeout: 45_000 });
          (await page.$$eval("a", (as) => as.map((a) => (a as HTMLAnchorElement).href))).filter((h) => /\/fr\/produits\/[^/#]+\/[^/#]+\/[^/#]+$/.test(h)).forEach((h) => links.add(h));
        }
        await pause();
      }
      const out: Product[] = [];
      for (const url of [...links].slice(0, Number(process.env.RENMANS_MAX || 400))) {
        try {
          await page.goto(url, { timeout: 45_000 });
          const name = (await page.textContent("h1"))?.trim() || "";
          const text = (await page.innerText("main").catch(() => page.innerText("body"))).replace(/\s+/g, " ");
          const kilo = perKilo(text);
          if (name && kilo) out.push({ name, brand: "Renmans", price: kilo.price, packSize: 1000, packUnit: kilo.unit, organic: isOrganic(name), url });
          else {
            const m = text.match(/€\s?\d+[,.]\d{2}(?:\s?\/\s?(?:pièce|pc|st))?/i);
            const price = m ? parsePrice(m[0]) : null;
            const pack = parsePack(name);
            if (name && price) out.push({ name, brand: "Renmans", price, packSize: pack?.size ?? 1, packUnit: pack?.unit ?? "pc", organic: isOrganic(name), url });
          }
        } catch (e) { console.warn("Renmans : fiche illisible", url, (e as Error).message); }
        await pause(1500 + Math.random() * 1500);
      }
      const seen = new Set<string>();
      catalog = out.filter((p) => !seen.has(p.name + p.price) && seen.add(p.name + p.price));
      return out;
    } finally { await donePage(page); }
  }
  return {
    store: "renmans",
    categories: ["vi"],
    async search(q) {
      const words = norm(q).split(" ").filter((w) => w.length > 2).map((w) => w.replace(/s$/, ""));
      return (await load()).filter((p) => words.every((w) => norm(p.name).includes(w)));
    },
  };
}
