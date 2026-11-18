import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { Trash2 } from "lucide-react";
import { db } from "../../firebase";
import { STORES, STORE_ORDER } from "../../lib/constants";
import { eur, norm } from "../../lib/text";
import type { Price, StoreId } from "../../lib/types";
import { fmtQty } from "../../lib/units";
import { useStore } from "../../state/store";
import { run } from "../../ui";
import { adminRebuildPriceBook, dt } from "./api";

export default function Prices() {
  const s = useStore();
  const [store, setStore] = useState<StoreId | "all">("all");
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<{ id: string; itemId: string; store: string; productName: string | null; decidedBy?: string }[]>([]);
  const [form, setForm] = useState({ item: "", store: "colruyt" as StoreId, size: "", price: "" });
  useEffect(() => { getDocs(collection(db, "productMatches")).then((r) => setMatches(r.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<(typeof matches)[number], "id">) })))).catch(() => {}); }, []);
  const prices = [...s.book.shared.entries()].map(([k, p]) => ({ k, p, item: s.idx.get(p.itemId) }))
    .filter((x) => (store === "all" || x.p.store === store) && (!q || norm(`${x.item?.name} ${x.p.productName}`).includes(norm(q))))
    .sort((a, b) => b.p.fetchedAt.localeCompare(a.p.fetchedAt)).slice(0, 300);
  const addManual = async () => {
    const item = s.idx.find(form.item);
    const size = Number(form.size.replace(",", ".")) || item?.packSize || 0, price = Number(form.price.replace(",", "."));
    if (!item || !size || !price) return;
    const p: Price = { itemId: item.id, store: form.store, organic: false, productName: `${item.name} (saisi à la main)`, packSize: size, packUnit: item.unit, packPrice: price, pricePerUnit: price / size, fetchedAt: new Date().toISOString(), source: "manuel" };
    await run(() => setDoc(doc(db, "prices", `${item.id}_${form.store}`), p), "Prix enregistré");
    setForm({ ...form, item: "", size: "", price: "" });
  };
  return <div className="stack">
    <div className="card"><h3>Carnet de prix de l'appli</h3><p>Les téléphones lisent un carnet compact (quelques documents) au lieu de chaque fiche. Il se met à jour tout seul après chaque capture ou passage du robot ; ce bouton le reconstruit en entier.</p>
      <button className="btn ghost" onClick={() => run(async () => { const r = await adminRebuildPriceBook({}); return r; }, "Carnet de prix reconstruit")}>↻ Reconstruire le carnet</button></div>
    <div className="card"><h3>Saisir un prix à la main</h3><p>Pour les enseignes sans boutique en ligne (Lidl, Aldi, Intermarché) ou pour corriger un prix.</p>
      <div className="grid2">
        <input className="input" list="adm-items" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} placeholder="Article (ex. lait)" />
        <datalist id="adm-items">{s.idx.all().map((i) => <option key={i.id} value={i.name} />)}</datalist>
        <select className="input" value={form.store} onChange={(e) => setForm({ ...form, store: e.target.value as StoreId })}>{STORE_ORDER.map((k) => <option key={k} value={k}>{STORES[k].label}</option>)}</select>
        <input className="input" inputMode="decimal" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder={`Contenance (${s.idx.find(form.item)?.unit || "g, ml ou pièces"})`} />
        <input className="input" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Prix € (2,49)" />
      </div>
      <button className="btn" style={{ marginTop: 10 }} onClick={addManual}>Enregistrer le prix</button>
    </div>
    <div className="row wrap"><input className="input grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un prix" style={{ minWidth: 200 }} /></div>
    <div className="scroll-x"><button className="chip" aria-pressed={store === "all"} onClick={() => setStore("all")}>Toutes</button>{STORE_ORDER.map((k) => <button key={k} className="chip" aria-pressed={store === k} onClick={() => setStore(k)}>{STORES[k].label}</button>)}</div>
    <div className="card"><div className="tbl-wrap"><table className="tbl"><thead><tr><th>Article</th><th>Produit</th><th>Enseigne</th><th className="r">Prix</th><th>Source</th><th>Date</th><th></th></tr></thead><tbody>
      {prices.map(({ k, p, item }) => <tr key={k}><td>{item?.name || p.itemId}{p.organic && " 🌿"}</td><td className="small">{p.url ? <a href={p.url} target="_blank" rel="noreferrer">{p.productName}</a> : p.productName}</td><td>{STORES[p.store]?.label}</td>
        <td className="r">{eur(p.packPrice)}<div className="small muted">{fmtQty(p.packSize, p.packUnit)}</div></td><td className="small">{p.source}</td><td className="small">{dt(p.fetchedAt)}</td>
        <td><button className="ib plain" aria-label="Supprimer" onClick={() => run(() => deleteDoc(doc(db, "prices", `${p.itemId}_${p.store}${p.organic ? "_bio" : ""}`)), "Prix supprimé")}><Trash2 size={16} /></button></td></tr>)}
    </tbody></table></div>{!prices.length && <p className="small muted">Aucun prix relevé pour l'instant.</p>}</div>
    <div className="card"><h3>Correspondances mémorisées ({matches.length})</h3><p>Produit retenu pour chaque article et enseigne. Supprime une correspondance fausse : le robot la recalculera.</p>
      {matches.map((m) => <div key={m.id} className="row between small" style={{ padding: "6px 0", borderTop: "1px solid var(--line)" }}>
        <span>{s.idx.get(m.itemId)?.name || m.itemId} · {STORES[m.store as StoreId]?.label} → <b>{m.productName || "aucun produit"}</b> <span className="muted">({m.decidedBy || "?"})</span></span>
        <button className="ib plain" aria-label="Supprimer" onClick={async () => { await run(() => deleteDoc(doc(db, "productMatches", m.id))); setMatches((x) => x.filter((y) => y.id !== m.id)); }}><Trash2 size={16} /></button></div>)}
    </div>
    <div className="card"><h3>Robot de prix</h3>
      <p>Renmans : chaque dimanche via GitHub Actions (Actions → « Robot de prix » → Run workflow pour un passage immédiat). Colruyt, Delhaize, Carrefour, AH : depuis ton ordinateur (voir scraper/README.md). Le résultat de chaque passage apparaît dans le tableau de bord.</p>
      <a className="btn soft sm" href="https://github.com/qtheun27/Stoemp/actions/workflows/prix.yml" target="_blank" rel="noreferrer">Ouvrir le robot sur GitHub</a>
    </div>
  </div>;
}
