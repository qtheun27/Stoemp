import { useMemo, useState } from "react";
import { Minus, Plus, Sparkles, Trash2, Camera } from "lucide-react";
import { CATS, LOCATIONS } from "../lib/constants";
import { cookable } from "../lib/catalog";
import { daysToExpiry, recipesUsing } from "../lib/planner";
import { predict } from "../lib/predict";
import { frDate } from "../lib/season";
import { norm } from "../lib/text";
import type { Item, Location, StockEntry } from "../lib/types";
import { fmtQty } from "../lib/units";
import { adjustStock, deleteStock, finishItem, quickSetup, saveSlots, setRateFactor, setStockEntry } from "../state/actions";
import { useStore } from "../state/store";
import { go } from "../route";
import { Empty, run, Sheet, toast, TopBar } from "../ui";
import ReceiptSheet from "./Receipt";

const step = (it: Item) => (it.unit === "pc" ? 1 : Math.max(10, Math.round(it.packSize / 4 / 10) * 10));

export default function Stock() {
  const s = useStore();
  const [loc, setLoc] = useState<Location | "all">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [setup, setSetup] = useState(false);
  const [receipt, setReceipt] = useState(false);

  const rows = useMemo(() => [...s.stock.entries()].map(([id, e]) => {
    const it = s.idx.get(id);
    const c = s.consumption.get(id);
    return it ? { id, e, it, p: c ? predict(c.events, e.qty, c.rateFactor) : null } : null;
  }).filter((x): x is NonNullable<typeof x> => !!x), [s.stock, s.consumption, s.idx]);

  const expiring = rows.filter((r) => r.e.qty > 0 && daysToExpiry(r.e) <= 3).sort((a, b) => daysToExpiry(a.e) - daysToExpiry(b.e));
  const runOut = rows.filter((r) => r.p?.nextRunOut && r.p.confidence !== "aucune").sort((a, b) => a.p!.nextRunOut!.getTime() - b.p!.nextRunOut!.getTime()).slice(0, 6);
  const shown = rows.filter((r) => (loc === "all" || r.e.location === loc) && (!q || norm(r.it.name).includes(norm(q)))).sort((a, b) => a.it.name.localeCompare(b.it.name, "fr"));
  const counts = Object.fromEntries((Object.keys(LOCATIONS) as Location[]).map((l) => [l, rows.filter((r) => r.e.location === l && r.e.qty > 0).length]));

  return (
    <>
      <TopBar title="Stock" sub={`${rows.filter((r) => r.e.qty > 0).length} articles à la maison`}>
        {s.app.features.receipt && <button className="ib" onClick={() => setReceipt(true)} aria-label="Scanner un ticket"><Camera size={20} /></button>}
        <button className="ib" onClick={() => setAdding(true)} aria-label="Ajouter au stock"><Plus size={20} /></button>
      </TopBar>
      <div className="content wide">
        <div className="cols">
          <div>
            {!rows.length && <div className="card" style={{ marginBottom: 12 }}>
              <h3>Mise en place rapide</h3>
              <p>Coche les articles courants déjà présents à la maison, avec un niveau approximatif. Deux minutes, et la prédiction des rachats démarre.</p>
              <button className="btn" onClick={() => setSetup(true)}><Sparkles size={18} />Commencer</button>
            </div>}
            {expiring.map((r) => {
              const rec = recipesUsing(cookable(s.recipes.values()), r.id)[0];
              const d = Math.ceil(daysToExpiry(r.e));
              return <div className="notice" key={r.id}><span className="grow">⏳ <b>{r.it.name}</b> {d <= 0 ? "périme aujourd'hui" : `périme dans ${d} j`}{rec ? <> · idée : {rec.name}</> : ""}</span>
                {rec && s.week && <button className="btn sm" onClick={() => {
                  const sl = [...s.week!.slots]; const k = sl.findIndex((x) => !x.cooked);
                  if (k < 0) return toast("Aucun repas libre cette semaine");
                  sl[k] = { ...sl[k], recipeId: rec.id, veg: false }; run(() => saveSlots(s, sl), "Repas placé dans la semaine"); go("semaine");
                }}>Placer</button>}</div>;
            })}
            <div className="row" style={{ margin: "4px 0 10px" }}>
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher dans le stock" aria-label="Rechercher" />
            </div>
            <div className="scroll-x">
              <button className="chip" aria-pressed={loc === "all"} onClick={() => setLoc("all")}>Tout</button>
              {(Object.keys(LOCATIONS) as Location[]).map((l) => <button key={l} className="chip" aria-pressed={loc === l} onClick={() => setLoc(l)}>{LOCATIONS[l].icon} {LOCATIONS[l].label} <span className="muted small">{counts[l]}</span></button>)}
            </div>
            {!shown.length ? <Empty icon="🧺">{rows.length ? "Rien ici." : "Ton stock est vide. Coche tes courses ou fais la mise en place rapide."}</Empty> :
              <div className="list" style={{ marginTop: 12 }}>{shown.map(({ id, e, it, p }) => {
                const d = daysToExpiry(e);
                return <div key={id} className="li" style={{ opacity: e.qty > 0 ? 1 : 0.55 }}>
                  <button className="main-t" onClick={() => setOpen(id)}>
                    <span className="name">{CATS[it.category].icon} {it.name}</span>
                    <span className="meta"><span className="num">{e.qty > 0 ? fmtQty(e.qty, it.unit) : "fini"}</span>
                      {isFinite(d) && <span className={`tag${d <= 3 ? " bad" : d <= 7 ? " warn" : ""}`}>{d < 0 ? "périmé" : `jusqu'au ${frDate(e.expiresAt!)}`}</span>}
                      {p?.nextRunOut && p.confidence !== "aucune" && <span className="tag">rupture ≈ {frDate(p.nextRunOut)}</span>}
                      {e.minQty != null && e.qty < e.minQty && <span className="tag warn">sous le minimum</span>}</span>
                  </button>
                  <button className="ib" aria-label="Moins" onClick={() => run(() => adjustStock(s, id, -Math.min(step(it), e.qty), "manuel"))} disabled={e.qty <= 0}><Minus size={18} /></button>
                  <button className="btn soft sm" onClick={() => run(() => finishItem(s, id, "manuel"), `${it.name} : fini`)} disabled={e.qty <= 0}>Fini</button>
                </div>;
              })}</div>}
          </div>
          <div className="side">
            <div className="card">
              <h3>À racheter bientôt</h3>
              <p>Rythme calculé sur les derniers achats (les plus récents comptent plus), corrigé par ce que tu consommes.</p>
              {!runOut.length ? <p className="small muted">Pas encore assez d'achats enregistrés. Coche tes courses ou scanne tes tickets.</p> :
                runOut.map((r) => <div key={r.id} className="row between" style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                  <button className="main-t" style={{ border: 0, background: "none", textAlign: "left", padding: 0 }} onClick={() => setOpen(r.id)}><b>{r.it.name}</b><div className="small muted">{r.p!.confidence === "faible" ? "suggestion" : `confiance ${r.p!.confidence}`} · {fmtQty(r.p!.dailyRate * 7, r.it.unit)}/semaine</div></button>
                  <span className="tag">{frDate(r.p!.nextRunOut!)}</span>
                </div>)}
            </div>
            <button className="btn ghost block" style={{ marginTop: 12 }} onClick={() => setSetup(true)}><Sparkles size={18} />Mise en place rapide</button>
          </div>
        </div>
      </div>
      {open && <ItemSheet id={open} onClose={() => setOpen(null)} />}
      {adding && <AddSheet onClose={() => setAdding(false)} onPick={(id) => { setAdding(false); setOpen(id); }} />}
      {setup && <SetupSheet onClose={() => setSetup(false)} />}
      {receipt && <ReceiptSheet onClose={() => setReceipt(false)} />}
    </>
  );
}

function ItemSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const s = useStore();
  const it = s.idx.get(id)!;
  const e: StockEntry = s.stock.get(id) || { qty: 0, unit: it.unit, location: "placard", updatedAt: 0 };
  const c = s.consumption.get(id);
  const p = c ? predict(c.events, e.qty, c.rateFactor) : null;
  const [qty, setQty] = useState(String(e.qty));
  const factor = c?.rateFactor || 1;
  const save = (patch: Partial<StockEntry>) => run(() => setStockEntry(s, id, patch));
  return <Sheet title={it.name} sub={`${CATS[it.category].label} · format courant ${fmtQty(it.packSize, it.unit)}`} onClose={onClose}>
    <label className="field">Quantité ({it.unit === "pc" ? "pièces" : it.unit})</label>
    <div className="row">
      <input className="input" inputMode="decimal" value={qty} onChange={(ev) => setQty(ev.target.value)} />
      <button className="btn" onClick={() => { const v = parseFloat(qty.replace(",", ".")); if (isFinite(v)) save({ qty: v }); toast("Quantité mise à jour"); }}>J'en ai encore</button>
    </div>
    <div className="chips" style={{ marginTop: 8 }}>
      {[1, 0.5, 0.15].map((l) => <button key={l} className="chip" onClick={() => { const v = Math.round(it.packSize * l * 10) / 10; setQty(String(v)); save({ qty: v }); }}>{l === 1 ? "Plein" : l === 0.5 ? "Moitié" : "Presque fini"}</button>)}
    </div>
    <label className="field">Emplacement</label>
    <div className="chips">{(Object.keys(LOCATIONS) as Location[]).map((l) => <button key={l} className="chip" aria-pressed={e.location === l} onClick={() => save({ location: l })}>{LOCATIONS[l].icon} {LOCATIONS[l].label}</button>)}</div>
    <div className="grid2" style={{ marginTop: 4 }}>
      <div><label className="field">Péremption (facultatif)</label><input className="input" type="date" value={e.expiresAt || ""} onChange={(ev) => save({ expiresAt: ev.target.value || null })} /></div>
      <div><label className="field">Minimum à garder</label><input className="input" inputMode="decimal" defaultValue={e.minQty ?? ""} placeholder="aucun" onBlur={(ev) => { const v = parseFloat(ev.target.value.replace(",", ".")); save({ minQty: isFinite(v) ? v : null }); }} /></div>
    </div>
    <hr className="sep" />
    <h3 style={{ margin: "4px 0" }}>Prédiction</h3>
    {p && p.dailyRate > 0 ? <p className="small">≈ {fmtQty(p.dailyRate * 7, it.unit)} par semaine · {p.purchases} achat{p.purchases > 1 ? "s" : ""} connus · confiance {p.confidence}{p.nextRunOut ? ` · rupture prévue le ${frDate(p.nextRunOut)}` : ""}{p.purchases < 3 ? " (suggestion seulement, pas d'ajout automatique)" : ""}</p>
      : <p className="small muted">Pas encore de rythme : il faut quelques achats.</p>}
    <div className="row wrap">
      <button className="btn soft sm" onClick={() => run(() => setRateFactor(s, id, factor * 1.25), "Noté : on en consomme plus")}>On en consomme plus</button>
      <button className="btn soft sm" onClick={() => run(() => setRateFactor(s, id, factor * 0.8), "Noté : on en consomme moins")}>On en consomme moins</button>
      {factor !== 1 && <span className="small muted">correction ×{factor.toFixed(2).replace(".", ",")}</span>}
    </div>
    <hr className="sep" />
    <div className="row wrap">
      <button className="btn ghost" onClick={() => { run(() => adjustStock(s, id, it.packSize, "achat"), "Ajouté (achat)"); onClose(); }}><Plus size={16} />Acheté 1</button>
      <button className="btn ghost" disabled={e.qty <= 0} onClick={() => { run(() => finishItem(s, id, "jeté"), "Noté comme jeté"); onClose(); }}>Jeté</button>
      <button className="btn danger" onClick={() => { run(() => deleteStock(s, id)); onClose(); }}><Trash2 size={16} />Retirer</button>
    </div>
  </Sheet>;
}

function AddSheet({ onClose, onPick }: { onClose: () => void; onPick: (id: string) => void }) {
  const s = useStore();
  const [q, setQ] = useState("");
  const res = q.length < 2 ? [] : s.idx.all().filter((i) => [i.name, ...i.aliases].some((n) => norm(n).includes(norm(q)))).slice(0, 20);
  return <Sheet title="Ajouter au stock" onClose={onClose}>
    <input className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un article (ex. riz, lessive)" />
    <div className="list" style={{ marginTop: 10 }}>{res.map((i) => <button key={i.id} className="li" style={{ width: "100%", border: 0, background: "none", textAlign: "left" }}
      onClick={async () => { await setStockEntry(s, i.id, { qty: i.packSize }); onPick(i.id); }}>
      <span className="main-t"><span className="name">{CATS[i.category].icon} {i.name}</span><span className="meta">{fmtQty(i.packSize, i.unit)}</span></span><Plus size={18} /></button>)}</div>
    {q.length >= 2 && !res.length && <p className="small muted">Inconnu du catalogue : ajoute-le d'abord à la liste de courses, l'IA le rangera.</p>}
  </Sheet>;
}

/** Mise en place rapide : articles courants, niveau approximatif. */
function SetupSheet({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const common = s.idx.all().filter((i) => i.common || i.staple).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, "fr"));
  const [lv, setLv] = useState<Record<string, number>>({});
  const n = Object.keys(lv).length;
  return <Sheet title="Mise en place rapide" sub="Ce qui est déjà à la maison" onClose={onClose}
    actions={<button className="btn sm" disabled={!n} onClick={async () => { await run(() => quickSetup(s, Object.entries(lv).map(([itemId, level]) => ({ itemId, level }))), `${n} articles ajoutés au stock`); onClose(); }}>Valider {n || ""}</button>}>
    <div className="list">{common.map((i) => <div key={i.id} className="li">
      <span className="main-t"><span className="name">{CATS[i.category].icon} {i.name}</span></span>
      <div className="chips" style={{ flexWrap: "nowrap" }}>{[[1, "Plein"], [0.5, "½"], [0.15, "Fin"]].map(([l, t]) =>
        <button key={t} className="chip" aria-pressed={lv[i.id] === l} onClick={() => setLv((m) => { const x = { ...m }; if (x[i.id] === l) delete x[i.id]; else x[i.id] = l as number; return x; })}>{t}</button>)}</div>
    </div>)}</div>
  </Sheet>;
}
