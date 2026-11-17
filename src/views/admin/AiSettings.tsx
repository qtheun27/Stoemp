import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { RefreshCw } from "lucide-react";
import { db } from "../../firebase";
import { run, Switch, toast } from "../../ui";
import { adminClearAiCache, adminListModels, adminTestModel, dt, usd, type Model } from "./api";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";
interface TaskConfig { model: string; effort: Effort; maxTokens: number; enabled: boolean }
interface AiConfig { enabled: boolean; monthlyBudgetUsd: number; tasks: Record<string, TaskConfig> }

// Mêmes valeurs par défaut que functions/src/config.ts
const DEFAULTS: AiConfig = {
  enabled: true, monthlyBudgetUsd: 20,
  tasks: {
    generateRecipes: { model: "claude-haiku-5-5", effort: "medium", maxTokens: 16000, enabled: true },
    structureMyDish: { model: "claude-haiku-5-5", effort: "low", maxTokens: 8000, enabled: true },
    readReceipt: { model: "claude-sonnet-5-5", effort: "low", maxTokens: 8000, enabled: true },
    classifyItem: { model: "claude-haiku-5-5", effort: "low", maxTokens: 1000, enabled: true },
    matchProduct: { model: "claude-haiku-5-5", effort: "low", maxTokens: 4000, enabled: true },
    extractPrices: { model: "claude-haiku-5-5", effort: "low", maxTokens: 16000, enabled: true },
  },
};
const TASKS: [string, string, string][] = [
  ["generateRecipes", "Recettes de la semaine", "Plats inventés selon les options du foyer. Haiku suffit pour des recettes familiales."],
  ["structureMyDish", "Mes plats", "Complète un plat perso (ingrédients, version végé, étapes)."],
  ["readReceipt", "Tickets de caisse", "Lit la photo du ticket (abréviations, ticket froissé) : Sonnet conseillé. Le modèle doit accepter les images."],
  ["classifyItem", "Rangement par rayon", "Rayon, unité, conservation d'un nouvel article. Modèle rapide conseillé."],
  ["matchProduct", "Correspondance produit", "Relie un article au bon produit d'une enseigne. Modèle rapide conseillé."],
  ["extractPrices", "Capteur de prix", "Lit les prix d'une page de magasin (bouton « Envoyer à Stoemp »)."],
];
const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];
const EFFORT_LABEL: Record<Effort, string> = { low: "faible", medium: "moyen", high: "élevé", xhigh: "très élevé", max: "maximum" };

export default function AiSettings() {
  const [cfg, setCfg] = useState<AiConfig>(DEFAULTS);
  const [models, setModels] = useState<Model[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<Record<string, string>>({});
  useEffect(() => onSnapshot(doc(db, "config", "ai"), (s) => {
    const d = s.data() as Partial<AiConfig> | undefined;
    const tasks: AiConfig["tasks"] = {};
    for (const k of Object.keys(DEFAULTS.tasks)) tasks[k] = { ...DEFAULTS.tasks[k], ...(d?.tasks?.[k] || {}) };
    setCfg({ ...DEFAULTS, ...d, tasks });
  }), []);
  const loadModels = async () => {
    setBusy(true);
    const r = await run(() => adminListModels({}));
    setBusy(false);
    if (r) { setModels(r.models); setFetchedAt(r.fetchedAt); try { localStorage.setItem("stoemp-models", JSON.stringify(r)); } catch { /* ignoré */ } }
  };
  useEffect(() => {
    try { const c = JSON.parse(localStorage.getItem("stoemp-models") || "null"); if (c) { setModels(c.models); setFetchedAt(c.fetchedAt); } } catch { /* ignoré */ }
    loadModels();
  }, []);
  const save = (patch: Partial<AiConfig>) => run(() => setDoc(doc(db, "config", "ai"), patch, { merge: true }));
  const setTask = (k: string, patch: Partial<TaskConfig>) => save({ tasks: { [k]: { ...cfg.tasks[k], ...patch } } });
  const info = (id: string) => models?.find((m) => m.id === id);
  const isNew = (m: Model) => Date.now() - Date.parse(m.createdAt) < 60 * 864e5;

  return <div className="stack">
    <div className="card">
      <div className="row between"><h3>IA</h3><Switch checked={cfg.enabled} onChange={(v) => save({ enabled: v })} label="IA activée" /></div>
      <p>{cfg.enabled ? "Les fonctions IA sont actives pour tous les foyers." : "Toutes les fonctions IA sont coupées : l'appli utilise uniquement la base de recettes."}</p>
      <label className="field">Budget mensuel (USD) — au-delà, les appels IA sont refusés jusqu'au mois suivant</label>
      <div className="row"><input className="input num-in" type="number" min={0} step={1} defaultValue={cfg.monthlyBudgetUsd} key={cfg.monthlyBudgetUsd} onBlur={(e) => save({ monthlyBudgetUsd: Math.max(0, Number(e.target.value) || 0) })} /><span className="small muted">0 = sans limite</span></div>
    </div>

    <div className="card">
      <div className="row between wrap"><div><h3>Modèles disponibles</h3><p style={{ margin: 0 }}>Liste lue en direct chez Anthropic pour ta clé{fetchedAt ? ` · mise à jour ${dt(fetchedAt)}` : ""}.</p></div>
        <button className="btn soft sm" disabled={busy} onClick={loadModels}><RefreshCw size={16} className={busy ? "spin" : ""} />Mettre à jour la liste</button></div>
      {models ? <div className="tbl-wrap" style={{ marginTop: 8 }}><table className="tbl"><thead><tr><th>Modèle</th><th>Identifiant</th><th className="r">Prix /M jetons</th><th></th></tr></thead><tbody>
        {models.map((m) => <tr key={m.id}><td>{m.name} {isNew(m) && <span className="tag ac">nouveau</span>}</td><td><code className="small">{m.id}</code></td>
          <td className="r small">{m.price ? `${usd(m.price[0])} / ${usd(m.price[1])}` : "—"}</td>
          <td className="r"><button className="btn soft sm" onClick={async () => { setTest((t) => ({ ...t, [m.id]: "…" })); const r = await run(() => adminTestModel({ model: m.id })); setTest((t) => ({ ...t, [m.id]: r ? `${r.ok ? "✅" : "❌"} ${(r.ms / 1000).toFixed(1)} s — ${r.text.slice(0, 120)}` : "❌" })); }}>Tester</button>
            {test[m.id] && <div className="small muted" style={{ maxWidth: 360, textAlign: "left" }}>{test[m.id]}</div>}</td></tr>)}
      </tbody></table></div> : <p className="small muted">{busy ? "Chargement…" : "Liste indisponible : la clé Anthropic est-elle configurée ?"}</p>}
      <p className="small muted">Les prix servent à estimer les coûts ; un modèle sans prix connu est utilisable mais son coût n'est pas compté dans le budget.</p>
    </div>

    <div className="card">
      <h3>Modèle par fonction</h3>
      <p>Changement immédiat (pris en compte en moins de 30 secondes).</p>
      {TASKS.map(([k, label, desc]) => {
        const t = cfg.tasks[k];
        const m = info(t.model);
        const known = !models || !!m;
        return <div className="task-card" key={k}>
          <div className="row between"><b>{label}</b><Switch checked={t.enabled} onChange={(v) => setTask(k, { enabled: v })} label={`${label} activé`} /></div>
          <div className="small muted">{desc}</div>
          <div className="grid2" style={{ marginTop: 8 }}>
            <div><label className="field">Modèle</label>
              <select className="input" value={t.model} onChange={(e) => setTask(k, { model: e.target.value })}>
                {!known && <option value={t.model}>{t.model} (introuvable)</option>}
                {(models || [{ id: t.model, name: t.model } as Model]).map((x) => <option key={x.id} value={x.id}>{x.name} — {x.id}{x.price ? ` (${x.price[0]} $ / ${x.price[1]} $)` : ""}</option>)}
              </select>
              {!known && <div className="small" style={{ color: "var(--bad)" }}>Ce modèle n'est plus proposé : choisis-en un autre.</div>}
            </div>
            <div className="row" style={{ alignItems: "flex-end", gap: 8 }}>
              <div className="grow"><label className="field">Effort</label>
                <select className="input" value={t.effort} disabled={m ? !m.effort : false} onChange={(e) => setTask(k, { effort: e.target.value as Effort })}>{EFFORTS.map((e) => <option key={e} value={e}>{EFFORT_LABEL[e]}</option>)}</select></div>
              <div><label className="field">Jetons max</label><input className="input num-in" style={{ width: 104 }} type="number" min={256} step={256} defaultValue={t.maxTokens} key={t.maxTokens} onBlur={(e) => setTask(k, { maxTokens: Math.max(256, Number(e.target.value) || 1000) })} /></div>
            </div>
          </div>
        </div>;
      })}
      <div className="row wrap" style={{ marginTop: 12 }}>
        <button className="btn ghost sm" onClick={() => run(() => setDoc(doc(db, "config", "ai"), DEFAULTS), "Réglages IA par défaut rétablis")}>Rétablir les réglages par défaut</button>
        <button className="btn ghost sm" onClick={async () => { const r = await run(() => adminClearAiCache({ fn: null })); if (r) toast(`${r.removed} réponses supprimées du cache`); }}>Vider le cache IA</button>
      </div>
    </div>
  </div>;
}
