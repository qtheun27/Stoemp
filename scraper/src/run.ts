// Robot de prix hebdomadaire. Usage privé : les prix sont écrits dans Firestore, jamais publiés.
// npm run prix                    → toutes les enseignes
// npm run prix -- colruyt renmans → enseignes choisies (ex. depuis ton ordinateur si un site bloque GitHub)
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { closeBrowser } from "./browser.js";
import { albertHeijn, carrefour, colruyt, delhaize } from "./connectors/web.js";
import { renmans } from "./connectors/renmans.js";
import { choose, pricePerUnit } from "./match.js";
import type { CatalogItem, Connector, StoreId } from "./types.js";

initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT || "stoemp-app" });
const db = getFirestore();
const MAX_ITEMS = Number(process.env.MAX_ITEMS || 150);
const ALL: Record<string, () => Connector> = { renmans, colruyt: () => colruyt(process.env.COLRUYT_PLACE_ID), delhaize, carrefour, ah: albertHeijn };

/** Articles prioritaires : ceux présents dans les listes et stocks des foyers, puis les courants. */
async function itemsToPrice(): Promise<CatalogItem[]> {
  const items = (await db.collection("items").get()).docs.map((d) => ({ id: d.id, ...d.data() }) as CatalogItem & { common?: boolean; staple?: boolean });
  const wanted = new Map<string, number>();
  for (const col of ["shopping", "stock"]) {
    const snap = await db.collectionGroup(col).select("itemId").get();
    snap.docs.forEach((d) => { const id = (d.get("itemId") as string) || d.id; wanted.set(id, (wanted.get(id) || 0) + 1); });
  }
  return items.filter((i) => !i.staple || wanted.has(i.id))
    .sort((a, b) => (wanted.get(b.id) || 0) - (wanted.get(a.id) || 0) || Number(!!b.common) - Number(!!a.common))
    .slice(0, MAX_ITEMS);
}

async function runStore(c: Connector, items: CatalogItem[]) {
  const report = { written: 0, ambiguous: 0, notFound: 0, errors: [] as string[], aborted: false };
  const now = new Date().toISOString();
  let consecutive = 0;
  for (const item of items) {
    if (c.categories && !c.categories.includes(item.category)) continue;
    for (const organic of item.organicAvailable ? [false, true] : [false]) {
      try {
        const products = await c.search(organic ? `${item.name} bio` : item.name);
        consecutive = 0;
        const mem = (await db.collection("productMatches").doc(`${c.store}_${item.id}`).get()).data();
        const pick = choose(item, c.store, products, mem?.productName, organic);
        if (pick.kind === "ambiguous" && !mem && !organic) {
          report.ambiguous++;
          await db.collection("matchQueue").add({ store: c.store, itemId: item.id, itemName: item.name,
            candidates: pick.candidates.map((p) => ({ id: p.id || null, name: p.name, packSize: p.packSize, packUnit: p.packUnit, price: p.price })) });
          continue;
        }
        if (pick.kind !== "ok") { if (!organic) report.notFound++; continue; }
        const p = pick.product;
        const doc = { itemId: item.id, store: c.store, organic, productName: [p.brand, p.name].filter(Boolean).join(" "), url: p.url || null,
          packSize: p.packSize, packUnit: p.packUnit, packPrice: p.price, pricePerUnit: pricePerUnit(p), promo: p.promo || null, promoUntil: null, fetchedAt: now, source: "robot" };
        await db.collection("prices").doc(`${item.id}_${c.store}${organic ? "_bio" : ""}`).set(doc);
        await db.collection("priceHistory").add(doc);
        report.written++;
      } catch (e) {
        report.errors.push(`${item.name} : ${(e as Error).message}`);
        // Trois échecs d'affilée : le site bloque probablement, on s'arrête sans casser le reste.
        if (++consecutive >= 3) { report.aborted = true; return report; }
      }
    }
  }
  return report;
}

async function main() {
  const wanted = process.argv.slice(2).filter((a) => ALL[a]);
  const stores = wanted.length ? wanted : Object.keys(ALL);
  const items = await itemsToPrice();
  console.log(`${items.length} articles à relever chez : ${stores.join(", ")}`);
  const run: Record<string, unknown> = { startedAt: FieldValue.serverTimestamp() };
  for (const s of stores) {
    const c = ALL[s]();
    try {
      const r = await runStore(c, items);
      run[s] = { ...r, errors: r.errors.slice(0, 20) };
      console.log(`${s} : ${r.written} prix, ${r.ambiguous} à départager par l'IA, ${r.notFound} introuvables${r.aborted ? " — ARRÊTÉ (site indisponible ou bloqué)" : ""}`);
      r.errors.slice(0, 5).forEach((e) => console.warn(`  ⚠ ${e}`));
    } catch (e) {
      run[s] = { fatal: (e as Error).message };
      console.error(`${s} : échec complet — ${(e as Error).message}`);
    }
  }
  await db.collection("scraperRuns").add({ ...run, endedAt: FieldValue.serverTimestamp() });
  // Carnet de prix compact de l'appli : reconstruit par une fonction déclenchée sur ce signal.
  for (const s of stores) await db.collection("priceBookDirty").doc(s).set({ at: Date.now() }).catch(() => {});
  await closeBrowser();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(0); /* un robot en panne ne casse jamais la CI */ });
