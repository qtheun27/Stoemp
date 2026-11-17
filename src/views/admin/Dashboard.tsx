import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { STORES } from "../../lib/constants";
import { run } from "../../ui";
import { adminStats, dt, last30, usd, type Stats } from "./api";

const TASK_LABEL: Record<string, string> = { generateRecipes: "Recettes de la semaine", structureMyDish: "Mes plats", readReceipt: "Tickets de caisse", classifyItem: "Rangement par rayon", matchProduct: "Correspondance produit", extractPrices: "Capteur de prix", growLibrary: "Bibliothèque de recettes", reviewLibrary: "Relecture des recettes" };

export function Bars({ data, label }: { data: number[]; label: (i: number) => string }) {
  const max = Math.max(1, ...data);
  return <>
    <div className="bars" role="img" aria-label="Histogramme sur 30 jours">{data.map((v, i) => <i key={i} title={`${label(i)} : ${v.toLocaleString("fr-BE", { maximumFractionDigits: 3 })}`} style={{ height: `${Math.max(2, (v / max) * 100)}%`, opacity: v ? 0.85 : 0.2 }} />)}</div>
    <div className="bars-legend"><span>il y a 30 j</span><span>max {max.toLocaleString("fr-BE", { maximumFractionDigits: 2 })}</span><span>aujourd'hui</span></div>
  </>;
}

export default function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => { setBusy(true); const r = await run(() => adminStats({})); if (r) setS(r); setBusy(false); };
  useEffect(() => { load(); }, []);
  if (!s) return <div className="empty">{busy ? "Calcul des statistiques…" : "Statistiques indisponibles (Functions déployées ?)"}</div>;
  const days = last30();
  const c = s.content;
  return <div className="stack">
    <div className="row between"><span className="muted small">Calculé à l'instant · 30 derniers jours</span><button className="btn soft sm" disabled={busy} onClick={load}><RefreshCw size={16} className={busy ? "spin" : ""} />Actualiser</button></div>
    <div className="kpis">
      <div className="kpi"><span>Utilisateurs</span><b>{s.users.total}</b><small>{s.users.google} Google · {s.users.anonymous} démo</small></div>
      <div className="kpi"><span>Actifs 7 jours</span><b>{s.users.active7}</b><small>{s.users.active1} aujourd'hui · {s.users.active30} sur 30 j</small></div>
      <div className="kpi"><span>Foyers</span><b>{c.households}</b><small>{c.weeks} semaines planifiées</small></div>
      <div className="kpi"><span>Coût IA du mois</span><b>{usd(s.ai.monthCost)}</b><small>{usd(s.ai.cost)} sur 30 j</small></div>
      <div className="kpi"><span>Appels IA (30 j)</span><b>{s.ai.calls}</b><small>{s.ai.errors} erreur{s.ai.errors > 1 ? "s" : ""} · {Math.round((s.ai.inTok + s.ai.outTok) / 1000)} k jetons</small></div>
      <div className="kpi"><span>Prix relevés</span><b>{Object.values(s.prices).reduce((a, p) => a + p.count, 0)}</b><small>{Object.values(s.prices).reduce((a, p) => a + p.fresh, 0)} récents</small></div>
    </div>
    <div className="grid2">
      <div className="card"><h3>Inscriptions par jour</h3><Bars data={days.map((d) => s.users.signups[d] || 0)} label={(i) => days[i]} /></div>
      <div className="card"><h3>Utilisateurs actifs par jour</h3><Bars data={days.map((d) => s.users.active[d] || 0)} label={(i) => days[i]} /></div>
      <div className="card"><h3>Appels IA par jour</h3><Bars data={days.map((d) => s.ai.byDay[d]?.calls || 0)} label={(i) => days[i]} /></div>
      <div className="card"><h3>Coût IA par jour ($)</h3><Bars data={days.map((d) => s.ai.byDay[d]?.cost || 0)} label={(i) => days[i]} /></div>
    </div>
    <div className="grid2">
      <div className="card"><h3>IA par fonction</h3><div className="tbl-wrap"><table className="tbl"><thead><tr><th>Fonction</th><th className="r">Appels</th><th className="r">Erreurs</th><th className="r">Durée moy.</th><th className="r">Coût</th></tr></thead>
        <tbody>{Object.entries(s.ai.byTask).sort((a, b) => b[1].calls - a[1].calls).map(([k, v]) => <tr key={k}><td>{TASK_LABEL[k] || k}</td><td className="r">{v.calls}</td><td className="r">{v.errors}</td><td className="r">{(v.ms / v.calls / 1000).toFixed(1)} s</td><td className="r">{usd(v.cost)}</td></tr>)}</tbody></table></div>
        {!Object.keys(s.ai.byTask).length && <p className="small muted">Aucun appel IA sur la période.</p>}</div>
      <div className="card"><h3>IA par modèle</h3><div className="tbl-wrap"><table className="tbl"><thead><tr><th>Modèle</th><th className="r">Appels</th><th className="r">Coût</th></tr></thead>
        <tbody>{Object.entries(s.ai.byModel).map(([k, v]) => <tr key={k}><td><code>{k}</code></td><td className="r">{v.calls}</td><td className="r">{usd(v.cost)}</td></tr>)}</tbody></table></div></div>
      <div className="card"><h3>Contenu</h3><div className="tbl-wrap"><table className="tbl"><tbody>
        {[["Lignes de courses", c.shoppingLines], ["Articles en stock (toutes maisons)", c.stockItems], ["Recettes de base", c.recipesBase], ["Recettes inventées par l'IA", c.recipesIa], ["Plats perso", c.recipesPerso], ["Articles du catalogue (base)", c.itemsBase], ["Articles ajoutés par l'IA", c.itemsIa], ["Réponses IA en cache", c.aiCache], ["Correspondances en attente", c.matchQueue]].map(([l, v]) => <tr key={l as string}><td>{l}</td><td className="r">{v}</td></tr>)}
      </tbody></table></div></div>
      <div className="card"><h3>Prix par enseigne</h3><div className="tbl-wrap"><table className="tbl"><thead><tr><th>Enseigne</th><th className="r">Prix</th><th className="r">Récents (14 j)</th></tr></thead>
        <tbody>{Object.entries(s.prices).map(([k, v]) => <tr key={k}><td><span className="store-dot" style={{ display: "inline-block", marginRight: 8, background: STORES[k as keyof typeof STORES]?.color }} />{STORES[k as keyof typeof STORES]?.label || k}</td><td className="r">{v.count}</td><td className="r">{v.fresh}</td></tr>)}</tbody></table></div></div>
    </div>
    <div className="card"><h3>Dernières erreurs IA</h3>{s.ai.recentErrors.length ? <div className="tbl-wrap"><table className="tbl"><tbody>{s.ai.recentErrors.map((e, i) => <tr key={i}><td className="small">{dt(e.at)}</td><td>{TASK_LABEL[e.task] || e.task}</td><td><code className="small">{e.model}</code></td><td className="small muted">{e.error}</td></tr>)}</tbody></table></div> : <p className="small muted">Aucune erreur. 👌</p>}</div>
    <div className="card"><h3>Derniers passages du robot de prix</h3>{s.runs.length ? s.runs.map((r, i) => <div key={i} className="small" style={{ padding: "6px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
      <b>{dt(r.endedAt as number)}</b> — {Object.entries(r).filter(([k]) => !["startedAt", "endedAt"].includes(k)).map(([k, v]) => { const x = v as { written?: number; aborted?: boolean; fatal?: string }; return `${STORES[k as keyof typeof STORES]?.label || k} : ${x.fatal ? "échec" : `${x.written ?? 0} prix${x.aborted ? " (arrêté)" : ""}`}`; }).join(" · ")}
    </div>) : <p className="small muted">Le robot n'a pas encore tourné.</p>}</div>
  </div>;
}
