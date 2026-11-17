import { useEffect, useState } from "react";
import { collection, getCountFromServer, getDoc, getDocs, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { STORES } from "../../lib/constants";
import type { Settings } from "../../lib/types";
import { mealCounts } from "../../lib/planner";
import type { Household } from "../../state/store";
import { run, Sheet, toast } from "../../ui";
import { adminCleanOrphanHouseholds, adminDeleteHousehold, dt } from "./api";

type Row = Household & { createdAt?: number };

export default function Households() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => getDocs(collection(db, "households")).then((s) => setRows(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Row, "id">) })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  if (!rows) return <div className="empty">Chargement…</div>;
  return <>
    <div className="card" style={{ marginBottom: 12 }}>
      <h3>Ménage</h3>
      <p>Supprime les foyers dont plus aucun membre n'a de compte (par exemple après la suppression des comptes démo), avec tout leur contenu.</p>
      <button className="btn ghost sm" disabled={busy} onClick={async () => { setBusy(true); const r = await run(() => adminCleanOrphanHouseholds({})); setBusy(false); if (r) { toast(`${r.removed} foyer(s) orphelin(s) supprimé(s)`); load(); } }}>{busy ? "Ménage en cours…" : "Supprimer les foyers orphelins"}</button>
    </div>
    <div className="list">{rows.map((h) => <button key={h.id} className="li" style={{ width: "100%", border: 0, background: "none", textAlign: "left" }} onClick={() => setOpen(h)}>
      <span className="main-t"><span className="name">🏠 {h.name}</span>
        <span className="meta"><span>{Object.keys(h.members || {}).length} membre(s)</span><span>{Object.values(h.memberNames || {}).join(", ")}</span><span>créé {dt(h.createdAt)}</span></span></span>
    </button>)}</div>
    {!rows.length && <div className="empty">Aucun foyer.</div>}
    {open && <Detail h={open} onClose={() => setOpen(null)} onDeleted={() => { setOpen(null); load(); }} />}
  </>;
}

function Detail({ h, onClose, onDeleted }: { h: Row; onClose: () => void; onDeleted: () => void }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const del = async () => {
    if (!armed) { setArmed(true); toast("Touche encore pour confirmer : le foyer et tout son contenu seront supprimés"); return; }
    setBusy(true);
    const r = await run(() => adminDeleteHousehold({ householdId: h.id }), "Foyer supprimé");
    setBusy(false);
    if (r) onDeleted();
  };
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<Partial<Settings> | null>(null);
  useEffect(() => {
    for (const sub of ["stock", "shopping", "weeks", "consumption", "paidPrices"]) getCountFromServer(collection(db, "households", h.id, sub)).then((r) => setCounts((c) => ({ ...c, [sub]: r.data().count }))).catch(() => {});
    getDoc(doc(db, "households", h.id, "meta", "settings")).then((s) => setSettings(s.data() as Partial<Settings>)).catch(() => {});
  }, [h.id]);
  return <Sheet title={h.name} sub={`Foyer ${h.id}`} onClose={onClose}>
    <h3>Membres</h3>
    {Object.entries(h.members || {}).map(([uid, role]) => <div key={uid} className="row between small" style={{ padding: "4px 0" }}><span>{h.memberNames?.[uid] || uid}</span><span className="tag">{role}</span></div>)}
    <h3 style={{ marginTop: 14 }}>Données</h3>
    <div className="kpis">{[["stock", "Articles en stock"], ["shopping", "Lignes de courses"], ["weeks", "Semaines"], ["consumption", "Articles suivis"], ["paidPrices", "Prix payés"]].map(([k, l]) => <div key={k} className="kpi"><span>{l}</span><b>{counts[k] ?? "…"}</b></div>)}</div>
    {settings && <>
      <h3 style={{ marginTop: 14 }}>Réglages</h3>
      <p className="small">{settings.persons} pers. · {(() => { const m = mealCounts(settings as Settings); return `${m.lunches} midi(s), ${m.dinners} soir(s)`; })()} · magasins : {(settings.stores || []).map((s) => STORES[s]?.label).join(", ")} · options : {Object.entries(settings.options || {}).filter(([, v]) => v === true).map(([k]) => k).join(", ") || "aucune"}</p>
    </>}
    <p className="small muted">Les données appartiennent au foyer : consulte-les sans les modifier. La suppression est définitive.</p>
    <button className="btn danger" disabled={busy} onClick={del}>{busy ? "Suppression…" : armed ? "Confirmer la suppression" : "Supprimer ce foyer"}</button>
  </Sheet>;
}
