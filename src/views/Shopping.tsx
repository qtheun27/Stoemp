import { useMemo, useState } from "react";
import { Camera, ClipboardCopy, ExternalLink, Pencil, Plus, Share2, Store, Trash2, Check as CheckIcon } from "lucide-react";
import { CAT_ORDER, CATS, STORES } from "../lib/constants";
import { bestPair, storeTotals } from "../lib/cost";
import { bestPrice, lineCost, priceAt } from "../lib/pricing";
import { frDate, nextShoppingDate, today } from "../lib/season";
import { buildShopping, shareText, type ShopLine } from "../lib/shopping";
import { eur } from "../lib/text";
import type { Cat, StoreId } from "../lib/types";
import { fmtQty } from "../lib/units";
import { addManual, vegCfg, checkLine, finishShopping, priceSel, removeLine, restoreLine, setCategory, setPricePaid } from "../state/actions";
import { useStore, type StoreState } from "../state/store";
import { Check, copyText, Empty, run, Sheet, toast, TopBar } from "../ui";
import ReceiptSheet from "./Receipt";

export const searchUrl = (store: StoreId, q: string) => {
  const e = encodeURIComponent(q);
  return ({
    colruyt: `https://www.colruyt.be/fr/produits?searchTerm=${e}`, renmans: "https://www.renmans.be/fr/produits",
    delhaize: `https://www.delhaize.be/fr/search?q=${e}`, carrefour: `https://www.carrefour.be/fr/search?q=${e}`,
    ah: `https://www.ah.be/zoeken?query=${e}`, lidl: `https://www.lidl.be/q/fr-BE/search?q=${e}`, aldi: "https://www.aldi.be/fr/", intermarche: "https://www.intermarche.be/",
  } as Record<StoreId, string>)[store];
};

export function useShopping(s: StoreState) {
  return useMemo(() => {
    const next = nextShoppingDate(s.settings.shoppingDays);
    const r = buildShopping({ slots: s.week?.slots || [], recipes: s.recipes, persons: s.week?.persons || s.settings.persons, idx: s.idx, stock: s.stock, consumption: s.consumption, docs: s.shopping, nextShopping: next, vegEaters: vegCfg(s).vegEaters, allergens: s.settings.options.allergens });
    return { ...r, next };
  }, [s.week, s.recipes, s.settings, s.idx, s.stock, s.consumption, s.shopping]);
}

export const lineQty = (l: ShopLine) => {
  if (l.unit === "pc" && l.packs > 0 && l.qty / l.packs > 1) return `${l.packs} paquet${l.packs > 1 ? "s" : ""} de ${l.qty / l.packs}`;
  return l.unit ? fmtQty(l.qty, l.unit) : l.qty ? `× ${l.qty}` : "";
};

export default function Shopping() {
  const s = useStore();
  const { lines, suggestions, next } = useShopping(s);
  const [text, setText] = useState("");
  const [view, setView] = useState<"rayon" | "magasin">("rayon");
  const [edit, setEdit] = useState<ShopLine | null>(null);
  const [receipt, setReceipt] = useState(false);
  const organic = priceSel(s);
  const pref = s.settings.preferredStore;
  const stores = s.settings.stores.length ? s.settings.stores : (["colruyt"] as StoreId[]);
  const done = lines.filter((l) => l.checked).length;
  const removed = s.shopping.filter((d) => d.removed);
  const priceOf = (l: ShopLine) => { const it = l.itemId ? s.idx.get(l.itemId) : undefined; const p = it && bestPrice(it, stores, pref, s.book, organic); return it && p ? { p, cost: lineCost(l.qty || it.packSize, p) } : null; };
  const total = lines.filter((l) => !l.checked).reduce((a, l) => a + (priceOf(l)?.cost || 0), 0);

  const frequent = Object.entries(s.prefs.history).filter(([, h]) => h.count >= 2 && !lines.some((l) => l.name.toLowerCase() === h.name.toLowerCase())).sort((a, b) => b[1].count - a[1].count).slice(0, 12);

  const add = async (t: string) => { const v = t.trim(); if (!v) return; const n = await run(() => addManual(s, v)); if (n) toast(`${n} ajouté`); };
  const share = async () => {
    const t = shareText(lines, lineQty, CATS, CAT_ORDER, (l) => !!(l.itemId && s.idx.get(l.itemId)?.ready));
    try { if (navigator.share) { await navigator.share({ title: "Liste de courses", text: t }); return; } } catch (e) { if ((e as Error).name === "AbortError") return; }
    toast((await copyText(t)) ? "Liste copiée : colle-la dans WhatsApp ou un SMS" : "Partage impossible ici");
  };

  return (
    <>
      <TopBar title="Courses" sub={`Prochaines courses : ${frDate(next)}`}>
        <button className="ib" onClick={share} aria-label="Partager"><Share2 size={20} /></button>
        <button className="ib" onClick={async () => toast((await copyText(shareText(lines, lineQty, CATS, CAT_ORDER, (l) => !!(l.itemId && s.idx.get(l.itemId)?.ready)))) ? "Liste copiée" : "Copie impossible")} aria-label="Copier"><ClipboardCopy size={20} /></button>
      </TopBar>
      <div className="content wide">
        <div className="cols">
          <div>
            <form className="addbar" onSubmit={(e) => { e.preventDefault(); add(text); setText(""); }}>
              <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ajouter (ex. 2 l de lait, papier toilette)" enterKeyHint="done" aria-label="Ajouter un article" />
              <button className="btn" aria-label="Ajouter"><Plus size={20} /></button>
            </form>
            {!!frequent.length && <div style={{ marginTop: 12 }}>
              <div className="row between"><b className="small">Tu achètes souvent</b>{frequent.length > 1 && <button className="btn soft sm" onClick={async () => { for (const [, h] of frequent) await addManual(s, h.name); toast("Habituels ajoutés"); }}>Tout ajouter</button>}</div>
              <div className="scroll-x" style={{ marginTop: 6 }}>{frequent.map(([k, h]) => <button key={k} className="chip" onClick={() => add(h.name)}>+ {h.name} <span className="muted small">×{h.count}</span></button>)}</div>
            </div>}
            {!!suggestions.length && <div style={{ marginTop: 12 }}>
              <b className="small">Bientôt fini ? (pas encore assez d'historique)</b>
              <div className="scroll-x" style={{ marginTop: 6 }}>{suggestions.map((x) => { const it = s.idx.get(x.itemId)!; return <button key={x.itemId} className="chip" onClick={() => add(it.name)}>+ {it.name} <span className="muted small">vers le {frDate(x.runOut)}</span></button>; })}</div>
            </div>}

            {!lines.length ? <Empty icon="🛒">Ta liste est vide.<br />Génère ta semaine ou ajoute des articles.</Empty> : <>
              <div className="row between" style={{ margin: "18px 2px 6px" }}>
                <div className="seg"><button aria-pressed={view === "rayon"} onClick={() => setView("rayon")}>Par rayon</button><button aria-pressed={view === "magasin"} onClick={() => setView("magasin")}>Par magasin</button></div>
                <span className="small muted num">{done}/{lines.length} · ≈ {eur(total)}</span>
              </div>
              <div className="progress"><i style={{ width: `${(done / lines.length) * 100}%` }} /></div>
              {view === "rayon" ? <ByCategory lines={lines} priceOf={priceOf} onEdit={setEdit} /> : <ByStore lines={lines} stores={stores} />}
              <div className="row wrap" style={{ marginTop: 18 }}>
                {s.app.features.receipt && <button className="btn ghost" onClick={() => setReceipt(true)}><Camera size={18} />Scanner le ticket</button>}
                {done > 0 && <button className="btn ghost" onClick={() => run(() => finishShopping(s), "Courses terminées")}><CheckIcon size={18} />Terminer les courses</button>}
              </div>
              {!!removed.length && <details className="card" style={{ marginTop: 14 }}><summary>Retirés de la liste ({removed.length})</summary>
                <div className="chips" style={{ marginTop: 8 }}>{removed.map((d) => <button key={d.id} className="chip" onClick={() => run(() => restoreLine(s, d.id))}>↩︎ {d.name}</button>)}</div></details>}
              <p className="small muted">Sel, poivre et huile ne sont listés que s'ils manquent au stock. Un article mal rangé ? Touche-le pour changer son rayon : l'appli s'en souviendra.</p>
            </>}
          </div>
          <div className="side"><PriceFreshness lines={lines} stores={stores} /></div>
        </div>
      </div>
      {edit && <LineSheet line={edit} onClose={() => setEdit(null)} />}
      {receipt && <ReceiptSheet onClose={() => setReceipt(false)} />}
    </>
  );
}

function ByCategory({ lines, priceOf, onEdit }: { lines: ShopLine[]; priceOf: (l: ShopLine) => { cost: number } | null; onEdit: (l: ShopLine) => void }) {
  const s = useStore();
  // Plats préparés à part des ingrédients, puis les rayons.
  const isReady = (l: ShopLine) => !!(l.itemId && s.idx.get(l.itemId)?.ready);
  const groups = [{ key: "pret", icon: "🥡", label: "Plats préparés", L: lines.filter(isReady) },
    ...CAT_ORDER.map((c) => ({ key: c, icon: CATS[c].icon, label: CATS[c].label, L: lines.filter((l) => l.category === c && !isReady(l)) }))];
  return <>{groups.map(({ key, icon, label, L: all }) => {
    const L = all.sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name, "fr"));
    if (!L.length) return null;
    return <section key={key}>
      <div className="cat-h"><span>{icon}</span>{label}<span className="muted">{L.filter((l) => !l.checked).length}</span></div>
      {/* En magasin : toucher la ligne la coche (grande cible) ; les articles cochés descendent ; ✎ pour modifier ou retirer. */}
      <div className="list">{[...L].sort((a, b) => Number(a.checked) - Number(b.checked)).map((l) => {
        const pc = priceOf(l);
        const tick = (v: boolean) => { try { navigator.vibrate?.(10); } catch { /* ignoré */ } run(() => checkLine(s, l, v)); };
        return <div key={l.id} className={`li${l.checked ? " done" : ""}`}>
          <Check checked={l.checked} onChange={tick} label={l.name} />
          <button className="main-t" onClick={() => tick(!l.checked)} aria-pressed={l.checked}>
            <span className="name">{l.name}</span>
            <span className="meta"><span className="num">{lineQty(l)}</span>
              <span className={`tag${l.reason === "stock" ? " warn" : l.reason === "manuel" ? "" : " ac"}`}>{l.reason === "repas" ? "repas" : l.reason === "stock" ? (l.detail || "stock bas") : "manuel"}</span>
              {l.pricePaid ? <span className="num">payé {eur(l.pricePaid)}</span> : pc ? <span className="num">≈ {eur(pc.cost)}</span> : null}</span>
          </button>
          <button className="ib plain" aria-label={`Modifier ${l.name}`} onClick={() => onEdit(l)}><Pencil size={18} /></button>
        </div>;
      })}</div>
    </section>;
  })}</>;
}

function ByStore({ lines, stores }: { lines: ShopLine[]; stores: StoreId[] }) {
  const s = useStore();
  const buy = lines.filter((l) => !l.checked).map((l) => ({ itemId: l.itemId, qty: l.qty, unit: l.unit }));
  const ctx = { idx: s.idx, book: s.book, organic: priceSel(s) };
  const totals = storeTotals(buy, stores, ctx).sort((a, b) => a.missing.length - b.missing.length || a.total - b.total);
  const pair = stores.length >= 2 ? bestPair(buy, stores, ctx) : null;
  const max = Math.max(...totals.map((t) => t.total), 1);
  const named = buy.filter((b) => b.itemId).length;
  return <>
    <div className="cat-h"><Store size={18} />Total chez chaque enseigne</div>
    <div className="list">{totals.map((t) => <div key={t.store} className="store-row">
      <span className="store-dot" style={{ background: STORES[t.store].color }} />
      <div className="grow"><b>{STORES[t.store].label}</b>{t.missing.length > 0 && <span className="small muted"> · {t.missing.length}/{named} articles non vendus</span>}
        {t.known === 0 ? <div className="small" style={{ color: "var(--warn, #d9a441)" }}>Aucun prix relevé : total estimé, à ne pas comparer</div>
          : t.estimated > 0 && <div className="small muted">{t.known} prix relevés · {t.estimated} estimés</div>}
        <div className="bar-bg"><i style={{ width: `${(t.total / max) * 100}%`, background: STORES[t.store].color, opacity: t.known === 0 ? 0.35 : 1 }} /></div></div>
      <b className="num" style={t.known === 0 ? { opacity: 0.6 } : undefined}>{t.known === 0 ? "≈ " : ""}{eur(t.total)}</b>
    </div>)}</div>
    {stores.length >= 2 && !pair && <p className="small muted" style={{ marginTop: 12 }}>Pas encore assez de prix relevés pour comparer deux magasins : capture des prix chez une deuxième enseigne (Réglages → Capteur de prix).</p>}
    {pair && <div className="card" style={{ marginTop: 12 }}>
      <h3>Meilleure combinaison de 2 magasins</h3>
      <p>{STORES[pair.stores[0]].label} + {STORES[pair.stores[1]].label} : <b className="num">{eur(pair.total)}</b>{pair.missing ? ` (${pair.missing} article(s) introuvables)` : ""}</p>
      {pair.estimated > 0 && <p className="small muted">Dont {pair.estimated} article(s) au prix estimé (aucun prix relevé dans ces deux magasins).</p>}
      {pair.stores.map((st) => { const ids = Object.entries(pair.split).filter(([, v]) => v === st).map(([k]) => s.idx.get(k)?.name); return ids.length ? <p key={st} className="small"><b>{STORES[st].label}</b> : {ids.join(", ")}</p> : null; })}
    </div>}
    <p className="small muted">Les montants arrondissent aux formats vendus. Sans prix relevé, un article est estimé (prix moyen × niveau de prix de l'enseigne) : utile pour un budget, pas pour comparer.</p>
  </>;
}

/** Fraîcheur des prix + liens pour les rafraîchir (bouton « Envoyer à Stoemp » sur le site de l'enseigne). */
function PriceFreshness({ lines, stores }: { lines: ShopLine[]; stores: StoreId[] }) {
  const s = useStore();
  const old = new Date(today().getTime() - s.app.freshDays * 864e5).toISOString().slice(0, 10);
  const stale = lines.filter((l) => l.itemId && !l.checked).map((l) => {
    const it = s.idx.get(l.itemId!)!;
    const ps = stores.map((st) => priceAt(it, st, s.book, priceSel(s))).filter((p): p is NonNullable<typeof p> => !!p);
    const fresh = ps.some((p) => p.source !== "estimation" && (p.date || "") >= old);
    return { it, fresh, ps };
  }).filter((x) => !x.fresh).slice(0, 12);
  return <div className="card">
    <h3>Prix à rafraîchir</h3>
    <p>{stale.length ? "Ces articles n'ont pas de prix réel récent. Ouvre la recherche, puis touche « 📥 Envoyer à Stoemp » (Réglages → Capteur de prix)." : "Tous les prix de ta liste sont récents. 👌"}</p>
    {stale.map(({ it }) => <div key={it.id} className="row between" style={{ padding: "6px 0", borderTop: "1px solid var(--line)" }}>
      <span className="grow">{it.name}</span>
      {stores.filter((st) => STORES[st].online && (!STORES[st].only || STORES[st].only!.includes(it.category))).slice(0, 2).map((st) =>
        <a key={st} className="btn soft sm" href={searchUrl(st, it.name)} target="_blank" rel="noreferrer">{STORES[st].label}<ExternalLink size={14} /></a>)}
    </div>)}
  </div>;
}

function LineSheet({ line, onClose }: { line: ShopLine; onClose: () => void }) {
  const s = useStore();
  const [price, setPrice] = useState(line.pricePaid ? String(line.pricePaid).replace(".", ",") : "");
  const [store, setStore] = useState<StoreId>((line.store as StoreId) || (s.settings.preferredStore !== "cheapest" ? s.settings.preferredStore : s.settings.stores[0] || "colruyt"));
  const it = line.itemId ? s.idx.get(line.itemId) : undefined;
  const prices = it ? s.settings.stores.map((st) => priceAt(it, st, s.book, priceSel(s))).filter((p): p is NonNullable<typeof p> => !!p) : [];
  return <Sheet title={line.name} sub={lineQty(line)} onClose={onClose}>
    {!!prices.length && <div className="list" style={{ marginBottom: 12 }}>{prices.sort((a, b) => a.pricePerUnit - b.pricePerUnit).map((p) => <div key={p.store} className="store-row">
      <span className="store-dot" style={{ background: STORES[p.store].color }} />
      <div className="grow"><b>{STORES[p.store].label}</b> <span className="small muted">{p.productName || ""}</span>
        <div className="small muted">{fmtQty(p.packSize, it!.unit)} · {p.source === "estimation" ? "estimation" : `${p.source}${p.shop ? ` · ${p.shop}` : ""} · ${p.date}`}{p.promo ? ` · 🏷 ${p.promo}` : ""}</div></div>
      <b className="num">{eur(p.packPrice)}</b></div>)}</div>}
    <label className="field">Prix payé</label>
    <div className="row">
      <input className="input" inputMode="decimal" placeholder="2,49" value={price} onChange={(e) => setPrice(e.target.value)} />
      <select className="input" value={store} onChange={(e) => setStore(e.target.value as StoreId)}>{s.settings.stores.map((st) => <option key={st} value={st}>{STORES[st].label}</option>)}</select>
    </div>
    <label className="field">Rayon</label>
    <div className="chips">{CAT_ORDER.map((c) => <button key={c} className="chip" aria-pressed={line.category === c} onClick={() => { run(() => setCategory(s, line, c as Cat), "Rayon mémorisé"); onClose(); }}>{CATS[c].icon} {CATS[c].label}</button>)}</div>
    <div className="row" style={{ marginTop: 18 }}>
      <button className="btn grow" onClick={() => { const v = parseFloat(price.replace(",", ".")); run(() => setPricePaid(s, line, isFinite(v) ? v : null, store), "Prix enregistré"); onClose(); }}>Enregistrer</button>
      <button className="btn danger" onClick={() => { run(() => removeLine(s, line)); onClose(); }}><Trash2 size={18} /></button>
    </div>
  </Sheet>;
}
