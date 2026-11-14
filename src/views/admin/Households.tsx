import { useEffect, useState } from "react";
import { collection, getCountFromServer, getDoc, getDocs, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { STORES } from "../../lib/constants";
import type { Settings } from "../../lib/types";
import type { Household } from "../../state/store";
import { Sheet } from "../../ui";
import { dt } from "./api";

type Row = Household & { createdAt?: number };

export default function Households() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<Row | null>(null);
  useEffect(() => { getDocs(collection(db, "households")).then((s) => setRows(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Row, "id">) })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))).catch(() => setRows([])); }, []);
  if (!rows) return <div className="empty">Chargement…</div>;
  return <>
    <div className="list">{rows.map((h) => <button key={h.id} className="li" style={{ width: "100%", border: 0, background: "none", textAlign: "left" }} onClick={() => setOpen(h)}>
      <span className="main-t"><span className="name">🏠 {h.name}</span>
        <span className="meta"><span>{Object.keys(h.members || {}).length} membre(s)</span><span>{Object.values(h.memberNames || {}).join(", ")}</span><span>créé {dt(h.createdAt)}</span></span></span>
    </button>)}</div>
    {!rows.length && <div className="empty">Aucun foyer.</div>}
    {open && <Detail h={open} onClose={() => setOpen(null)} />}
  </>;
}

function Detail({ h, onClose }: { h: Row; onClose: () => void }) {
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
      <p className="small">{settings.persons} pers. · {settings.mealsPerDay === 2 ? "midi + soir" : "soir"} · magasins : {(settings.stores || []).map((s) => STORES[s]?.label).join(", ")} · options : {Object.entries(settings.options || {}).filter(([, v]) => v === true).map(([k]) => k).join(", ") || "aucune"}</p>
    </>}
    <p className="small muted">Consultation en lecture seule : les données appartiennent au foyer.</p>
  </Sheet>;
}
