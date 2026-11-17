import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { COURSES, COURSE_ORDER, CUISINES, CUISINE_ORDER } from "../../lib/constants";
import type { Course, Cuisine } from "../../lib/types";
import { useStore } from "../../state/store";
import { Check, run, Stepper } from "../../ui";
import { adminLibraryJob, dt, usd } from "./api";

interface Job { status: "running" | "paused" | "stopped" | "done"; made: number; refused?: string[]; refusedCount?: number; step: number; startedAt: number; updatedAt: number; lastError: string | null;
  queue: { cuisine: Cuisine; course: string; remaining: number; made: number; failures: number }[] }

/** Coût moyen observé d'une recette générée par Haiku 5.5 (catalogue en entrée + recette en sortie), en $. */
const COST_PER_RECIPE = 0.0015; // écriture Haiku + relecture Sonnet, refus compris
/** Répartition conseillée par cuisine (≈ 555 × 9 cuisines ≈ 5 000 recettes). */
const DEFAULT_PER: Record<Course, number> = { plat: 250, dessert: 70, entree: 60, soupe: 50, aperitif: 40, accompagnement: 40, patisserie: 30, petitdej: 15 };

/** Agrandir la bibliothèque de recettes : tâche de fond côté serveur, qui continue même console fermée. */
export default function Library() {
  const s = useStore();
  const [job, setJob] = useState<Job | null>(null);
  const [per, setPer] = useState<Record<Course, number>>(DEFAULT_PER);
  const [cuisines, setCuisines] = useState<Cuisine[]>(CUISINE_ORDER);
  useEffect(() => onSnapshot(doc(db, "libraryJobs", "current"), (d) => setJob((d.data() as Job) || null), () => {}), []);

  const all = [...s.recipes.values()].filter((r) => r.source === "base" && !r.deleted);
  const by = (c: Cuisine, k: string) => all.filter((r) => r.cuisine === c && (r.course || "plat") === k).length;
  const total = cuisines.length * Object.values(per).reduce((a, b) => a + b, 0);
  const left = job?.queue.reduce((a, q) => a + q.remaining, 0) || 0;
  const act = (action: "start" | "pause" | "resume" | "stop") => run(() => adminLibraryJob({ action, perCuisine: per, cuisines }), action === "start" ? "Génération lancée : elle continue en arrière-plan" : "C'est noté");

  return <div className="stack">
    <div className="card">
      <h3>📚 Bibliothèque : {all.length} recettes</h3>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Cuisine</th>{COURSE_ORDER.map((k) => <th key={k} title={COURSES[k].label}>{COURSES[k].icon}</th>)}</tr></thead>
        <tbody>{CUISINE_ORDER.map((c) => <tr key={c}><td>{CUISINES[c].icon} {CUISINES[c].label}</td>{COURSE_ORDER.map((k) => <td key={k} className="num">{by(c, k)}</td>)}</tr>)}</tbody></table></div>
    </div>

    {job && <div className="card">
      <h3>{job.status === "running" ? "⏳ Génération en cours" : job.status === "paused" ? "⏸ En pause" : job.status === "done" ? "✅ Terminé" : "⏹ Arrêté"}</h3>
      <p>{job.made} recettes ajoutées · {left} restantes · dernière activité {dt(job.updatedAt)}</p>
      {left > 0 && <div className="progress"><i style={{ width: `${(job.made / Math.max(1, job.made + left)) * 100}%` }} /></div>}
      {job.lastError && <p className="small" style={{ color: "var(--bad)" }}>Dernière erreur : {job.lastError}</p>}
      {!!job.refusedCount && <details style={{ marginTop: 8 }}><summary className="small">{job.refusedCount} recettes refusées par le relecteur</summary>
        <ul className="small muted">{(job.refused || []).slice(-30).reverse().map((x) => <li key={x}>{x}</li>)}</ul></details>}
      <div className="row wrap" style={{ marginTop: 10 }}>
        {job.status === "running" && <button className="btn ghost" onClick={() => act("pause")}>⏸ Pause</button>}
        {job.status === "paused" && <button className="btn" onClick={() => act("resume")}>▶ Reprendre</button>}
        {(job.status === "running" || job.status === "paused") && <button className="btn ghost" onClick={() => act("stop")}>⏹ Arrêter</button>}
      </div>
    </div>}

    <div className="card">
      <h3>Agrandir la bibliothèque</h3>
      <p className="small muted">L'IA propose des recettes authentiques par cuisine, sans doublon ; chaque ingrédient est relié au catalogue et chaque plat avec viande a sa version végé protéinée. Lots de 15, à la suite, même console fermée ; le budget IA du mois reste un plafond.</p>
      <div className="chips">{CUISINE_ORDER.map((c) => { const on = cuisines.includes(c);
        return <label key={c} className="chip"><Check checked={on} onChange={() => setCuisines(on ? cuisines.filter((x) => x !== c) : [...cuisines, c])} label={CUISINES[c].label} />{CUISINES[c].icon} {CUISINES[c].label}</label>; })}</div>
      <div className="row wrap" style={{ gap: 14, margin: "12px 0" }}>
        {COURSE_ORDER.map((k) => <div key={k}><div className="small muted">{COURSES[k].icon} {COURSES[k].label}</div>
          <Stepper value={per[k]} min={0} max={2000} step={k === "plat" ? 50 : 10} onChange={(v) => setPer({ ...per, [k]: v })} /></div>)}
      </div>
      <p>≈ <b>{total.toLocaleString("fr-BE")}</b> recettes · coût estimé <b>{usd(total * COST_PER_RECIPE)}</b> · environ {Math.max(1, Math.round(total / 15 / 40))} h</p>
      <button className="btn" disabled={!cuisines.length || !total || job?.status === "running"} onClick={() => { if (job?.status === "paused" && !confirm("Une génération est en pause : la remplacer ?")) return; act("start"); }}>✨ Lancer la génération</button>
      {job?.status === "running" && <p className="small muted">Une génération est déjà en cours.</p>}
      <p className="small muted" style={{ marginTop: 8 }}>Les recettes arrivent dans l'appli au fur et à mesure (onglet Plats). Une recette ratée peut être masquée depuis l'onglet Catalogue → Recettes de base.</p>
    </div>
  </div>;
}

