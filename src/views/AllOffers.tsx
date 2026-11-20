import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { STORES } from "../lib/constants";
import { eur } from "../lib/text";
import type { Item, Offer, StoreId } from "../lib/types";
import { fmtQty } from "../lib/units";
import { chooseProduct } from "../state/actions";
import { useStore } from "../state/store";
import { run } from "../ui";

type Row = Offer & { store: StoreId; ppu: number };
const TIER: Record<string, string> = { eco: "premier prix", maison: "marque du magasin", marque: "grande marque" };

/**
 * Tous les produits relevés pour un article, dans les magasins du foyer, chargés seulement à l'ouverture de la fiche
 * (l'appli garde au quotidien un carnet compact de 8 produits par article).
 */
export function AllOffers({ item, onChosen }: { item: Item; onChosen: () => void }) {
  const s = useStore();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [all, setAll] = useState(false);
  const [store, setStore] = useState<StoreId | "">("");
  useEffect(() => {
    let live = true;
    Promise.all(s.settings.stores.flatMap((st) => [`${item.id}_${st}`, `${item.id}_${st}_bio`].map((id) => getDoc(doc(db, "prices", id)).catch(() => null))))
      .then((snaps) => {
        const seen = new Set<string>(), out: Row[] = [];
        for (const d of snaps) {
          if (!d?.exists()) continue;
          const st = d.get("store") as StoreId;
          for (const o of (d.get("offers") || []) as Offer[]) {
            const k = `${st}|${o.name}|${o.size}`;
            if (seen.has(k) || !(o.size > 0)) continue;
            seen.add(k); out.push({ ...o, store: st, ppu: o.price / o.size });
          }
        }
        if (live) setRows(out.sort((a, b) => a.ppu - b.ppu));
      });
    return () => { live = false; };
  }, [item.id, s.settings.stores]);

  if (rows === null) return <p className="small muted">Chargement de tous les produits…</p>;
  if (!rows.length) return <p className="small muted">Aucun produit relevé pour cet article. Envoie une page du magasin avec le favori (Réglages → Capteur de prix).</p>;
  const stores = [...new Set(rows.map((r) => r.store))];
  const list = rows.filter((r) => !store || r.store === store);
  const per = item.unit === "g" ? "kg" : item.unit === "ml" ? "l" : "pièce", mult = item.unit === "pc" ? 1 : 1000;
  return <div>
    <div className="row between"><b>Tous les produits ({rows.length})</b></div>
    {stores.length > 1 && <div className="chips" style={{ margin: "6px 0" }}>
      <button className="chip" aria-pressed={!store} onClick={() => setStore("")}>Tous</button>
      {stores.map((st) => <button key={st} className="chip" aria-pressed={store === st} onClick={() => setStore(st)}>{STORES[st].label}</button>)}
    </div>}
    <div className="list">{(all ? list : list.slice(0, 25)).map((r) => <div key={`${r.store}|${r.name}|${r.size}`} className="store-row">
      <span className="store-dot" style={{ background: STORES[r.store].color }} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div>{r.name}</div>
        <div className="small muted">{STORES[r.store].label} · {fmtQty(r.size, item.unit)} · {eur(r.ppu * mult)}/{per}{r.organic ? " · bio" : ""}{TIER[r.tier] ? ` · ${TIER[r.tier]}` : ""}{r.promo ? ` · 🏷 ${r.promo}` : ""}</div>
      </div>
      <div style={{ textAlign: "right" }}><b className="num">{eur(r.price)}</b><br />
        <button className="btn soft sm" style={{ marginTop: 4 }} onClick={() => { run(() => chooseProduct(s, item.id, r.store, r), `${item.name} : ${r.name} chez ${STORES[r.store].label}`); onChosen(); }}>Je prends</button></div>
    </div>)}</div>
    {!all && list.length > 25 && <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => setAll(true)}>Voir les {list.length - 25} autres</button>}
  </div>;
}
