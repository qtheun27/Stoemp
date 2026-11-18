import { getFirestore } from "firebase-admin/firestore";

/**
 * Carnet de prix compact : au lieu de lire ~1 500 fiches « prices » une par une, l'appli lit quelques documents
 * « priceBook/{magasin}_{n} » (4 morceaux par magasin, sous la limite de 1 Mo d'un document).
 * Reconstruit d'un bloc après chaque capture, modification ou passage du robot.
 * Entrée : clé = identifiant de la fiche (itemId_magasin[_bio]) → valeurs courtes (voir expandBook côté appli).
 */
export const BOOK_SHARDS = 4;
const MAX_OFFERS = 15;

const shardOf = (key: string) => { let h = 0; for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % BOOK_SHARDS; };

type Off = { name: string; tier: string; organic: boolean; tags?: string[]; size: number | string; price: number; ppu?: number; promo?: string | null };

/** Garde les variantes les plus utiles : les moins chères de chaque gamme / bio / régime, puis les moins chères tout court. */
function keepOffers(offers: Off[]): Off[] {
  const sorted = [...offers].sort((a, b) => (a.ppu ?? a.price / Number(a.size)) - (b.ppu ?? b.price / Number(b.size)));
  const out: Off[] = [], seen = new Set<string>();
  for (const o of sorted) { const k = `${o.tier}|${o.organic}|${(o.tags || []).join(",")}`; if (!seen.has(k)) { seen.add(k); out.push(o); } }
  for (const o of sorted) { if (out.length >= MAX_OFFERS) break; if (!out.includes(o)) out.push(o); }
  return out.slice(0, MAX_OFFERS);
}

function entry(d: FirebaseFirestore.DocumentData, bio: boolean) {
  return {
    i: d.itemId, b: d.organic ? 1 : 0, n: d.productName || "", z: Number(d.packSize) || 1, un: d.packUnit, p: d.packPrice, u: d.pricePerUnit,
    pr: d.promo || null, d: d.fetchedAt || "", src: d.source || "capture", sh: d.shop || null, ...(d.source === "robot" && d.url ? { url: d.url } : {}),
    // Les variantes ne sont gardées que sur la fiche principale (la fiche bio n'en a pas besoin).
    ...(!bio && Array.isArray(d.offers) && d.offers.length ? { f: keepOffers(d.offers).map((o) => [o.name, o.tier, o.organic ? 1 : 0, (o.tags || []).join(","), Number(o.size), o.price, o.promo || null]) } : {}),
  };
}

/** Reconstruit le carnet des magasins donnés (tous si vide). */
export async function rebuildPriceBook(stores?: string[], db: FirebaseFirestore.Firestore = getFirestore()) {
  const snap = stores?.length ? await db.collection("prices").where("store", "in", stores.slice(0, 30)).get() : await db.collection("prices").get();
  const shards = new Map<string, Record<string, unknown>>();
  const all = new Set(stores || []);
  for (const doc of snap.docs) {
    const d = doc.data();
    if (!d.itemId || !d.store) continue;
    all.add(d.store);
    const id = `${d.store}_${shardOf(doc.id)}`;
    if (!shards.has(id)) shards.set(id, {});
    shards.get(id)![doc.id] = entry(d, doc.id.endsWith("_bio"));
  }
  const batch = db.batch();
  for (const s of all) for (let n = 0; n < BOOK_SHARDS; n++) {
    const id = `${s}_${n}`;
    batch.set(db.collection("priceBook").doc(id), { store: s, e: shards.get(id) || {}, at: Date.now() });
  }
  await batch.commit();
  return snap.size;
}
