import { chromium, type Browser, type Page } from "playwright";
import { fromJsonLd, isOrganic, parsePack, parsePrice } from "./parse.js";
import type { Product } from "./types.js";

let browser: Browser | null = null;
export async function getBrowser() {
  if (!browser) browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true });
  return browser;
}
export async function closeBrowser() { await browser?.close(); browser = null; }

/** Pause polie entre deux requêtes (2 à 4 s). */
export const pause = (ms = 2000 + Math.random() * 2000) => new Promise((r) => setTimeout(r, ms));

export async function newPage(): Promise<Page> {
  const ctx = await (await getBrowser()).newContext({ locale: "fr-BE", userAgent: "Mozilla/5.0 (usage privé — Stoemp, relevé hebdomadaire de prix)" });
  return ctx.newPage();
}

const NAME_KEYS = ["name", "longName", "LongName", "productName", "title", "description"];
const PRICE_KEYS = ["price", "basicPrice", "currentPrice", "sellingPrice", "value", "amount"];

/** Parcourt un JSON quelconque et en extrait des objets « produit » plausibles (nom + prix). */
export function productsFromJson(data: unknown, url: string): Product[] {
  const out: Product[] = [];
  const priceOf = (v: unknown): number | null => {
    if (typeof v === "number" && v > 0 && v < 1000) return v;
    if (typeof v === "string") return parsePrice(v);
    if (v && typeof v === "object") for (const k of PRICE_KEYS) { const p = priceOf((v as Record<string, unknown>)[k]); if (p) return p; }
    return null;
  };
  const visit = (o: unknown, depth: number) => {
    if (!o || typeof o !== "object" || depth > 8) return;
    if (Array.isArray(o)) { o.forEach((x) => visit(x, depth + 1)); return; }
    const x = o as Record<string, unknown>;
    const nameKey = NAME_KEYS.find((k) => typeof x[k] === "string" && (x[k] as string).length > 2);
    const priceKey = PRICE_KEYS.find((k) => priceOf(x[k]) != null);
    if (nameKey && priceKey) {
      const name = String(x[nameKey]);
      const content = [x.content, x.packSize, x.netContent, x.weight, x.quantity, x.size, name].filter((v) => typeof v === "string").join(" ");
      const pack = parsePack(content);
      out.push({ id: String(x.id ?? x.productId ?? x.retailProductNumber ?? ""), name, brand: typeof x.brand === "string" ? x.brand : (x.brand as { name?: string })?.name ?? null,
        price: priceOf(x[priceKey])!, packSize: pack?.size ?? null, packUnit: pack?.unit ?? null, organic: isOrganic(name), url });
      return;
    }
    Object.values(x).forEach((v) => visit(v, depth + 1));
  };
  visit(data, 0);
  return out;
}

/** Ouvre une page de recherche et récupère les produits (réponses JSON de l'enseigne + JSON-LD). */
export async function searchPage(url: string, apiHint: RegExp): Promise<Product[]> {
  const page = await newPage();
  const found: Product[] = [];
  page.on("response", async (res) => {
    if (!apiHint.test(res.url()) || !(res.headers()["content-type"] || "").includes("json")) return;
    try { found.push(...productsFromJson(await res.json(), url)); } catch { /* réponse illisible */ }
  });
  try {
    const res = await page.goto(url, { timeout: 45_000, waitUntil: "domcontentloaded" });
    if (res && res.status() >= 400) throw new Error(`HTTP ${res.status()} sur ${new URL(url).hostname}`);
    await page.waitForTimeout(4000);
    const ld = await page.$$eval('script[type="application/ld+json"]', (s) => s.map((x) => x.textContent || ""));
    found.push(...fromJsonLd(ld, url));
  } finally { await page.context().close(); }
  const seen = new Set<string>();
  return found.filter((p) => { const k = p.name + p.price; if (seen.has(k)) return false; seen.add(k); return true; });
}
