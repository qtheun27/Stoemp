import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { DEFAULT_APP_CONFIG, type AppConfig } from "../../lib/appConfig";
import { STORES, STORE_ORDER, WEEKDAYS_SUN0 } from "../../lib/constants";
import { useStore } from "../../state/store";
import { run, Stepper, Switch } from "../../ui";

const FEATURES: [keyof AppConfig["features"], string, string][] = [
  ["demo", "Mode démo", "Bouton « Essayer sans compte » sur l'écran d'accueil"],
  ["ai", "Fonctions IA dans l'appli", "Plats inventés, « Compléter avec l'IA »"],
  ["receipt", "Tickets de caisse", "Photo du ticket lue par l'IA"],
  ["capture", "Capteur de prix", "Favori « Envoyer à Stoemp »"],
  ["invites", "Invitations", "Partage d'un foyer par lien"],
  ["multiHousehold", "Plusieurs foyers", "Créer d'autres foyers depuis les réglages"],
];

/** Réglages dynamiques : appliqués en direct chez tous les utilisateurs. */
export default function AppSettings() {
  const { app } = useStore();
  const save = (patch: Partial<AppConfig>) => run(() => setDoc(doc(db, "config", "app"), JSON.parse(JSON.stringify(patch)), { merge: true }));
  const d = app.defaults;
  const setD = (p: Partial<AppConfig["defaults"]>) => save({ defaults: { ...d, ...p } });
  return <div className="grid2">
    <div className="stack">
      <div className="card"><h3>Modules</h3><p>Active ou coupe une fonction pour tout le monde, sans redéployer.</p>
        {FEATURES.map(([k, l, desc]) => <div className="opt" key={k}><div className="t"><b>{l}</b><div className="d">{desc}</div></div><Switch checked={app.features[k]} onChange={(v) => save({ features: { ...app.features, [k]: v } })} label={l} /></div>)}
      </div>
      <div className="card"><h3>Maintenance</h3><p>Les utilisateurs voient ce message à la place de l'appli ; toi, tu gardes l'accès.</p>
        <div className="row between"><b>Mode maintenance</b><Switch checked={app.maintenance.on} onChange={(v) => save({ maintenance: { ...app.maintenance, on: v } })} label="Mode maintenance" /></div>
        <textarea className="input" rows={2} style={{ marginTop: 8 }} defaultValue={app.maintenance.message} onBlur={(e) => save({ maintenance: { ...app.maintenance, message: e.target.value } })} />
      </div>
      <div className="card"><h3>Message d'annonce</h3><p>Bandeau affiché en haut de l'appli (vide = aucun).</p>
        <input className="input" defaultValue={app.banner.text} placeholder="ex. Nouveau : scanne tes tickets de caisse !" onBlur={(e) => save({ banner: { ...app.banner, text: e.target.value.trim() } })} />
        <div className="chips" style={{ marginTop: 8 }}>{(["info", "warn"] as const).map((t) => <button key={t} className="chip" aria-pressed={app.banner.tone === t} onClick={() => save({ banner: { ...app.banner, tone: t } })}>{t === "info" ? "Information" : "Avertissement"}</button>)}</div>
      </div>
    </div>
    <div className="stack">
      <div className="card"><h3>Génération des repas</h3>
        <label className="field">Part de la semaine inventée par l'IA (option cochée) : {Math.round(app.aiWeekShare * 100)} %</label>
        <input type="range" min={0} max={1} step={0.1} defaultValue={app.aiWeekShare} onChange={(e) => save({ aiWeekShare: Number(e.target.value) })} style={{ width: "100%", accentColor: "var(--ac)" }} />
        <label className="field">Un prix reste « récent » pendant</label>
        <Stepper value={app.freshDays} min={3} max={60} onChange={(v) => save({ freshDays: v })} fmt={(v) => `${v} jours`} />
      </div>
      <div className="card"><h3>Réglages d'un nouveau foyer</h3>
        <div className="row wrap" style={{ gap: 16 }}>
          <div><label className="field">Personnes</label><Stepper value={d.persons} onChange={(v) => setD({ persons: v })} /></div>
          <div><label className="field">Plats perso / semaine</label><Stepper value={d.mineN} min={0} max={7} onChange={(v) => setD({ mineN: v })} /></div>
        </div>
        <label className="field">Repas</label>
        <div className="chips">{([1, 2] as const).map((m) => <button key={m} className="chip" aria-pressed={d.mealsPerDay === m} onClick={() => setD({ mealsPerDay: m })}>{m === 1 ? "7 · soir" : "14 · midi + soir"}</button>)}</div>
        <label className="field">Magasins</label>
        <div className="chips">{STORE_ORDER.map((k) => <button key={k} className="chip" aria-pressed={d.stores.includes(k)} onClick={() => setD({ stores: d.stores.includes(k) ? d.stores.filter((x) => x !== k) : [...d.stores, k] })}>{STORES[k].label}</button>)}</div>
        <label className="field">Jours de courses</label>
        <div className="chips">{[1, 2, 3, 4, 5, 6, 0].map((x) => <button key={x} className="chip" aria-pressed={d.shoppingDays.includes(x)} onClick={() => setD({ shoppingDays: d.shoppingDays.includes(x) ? d.shoppingDays.filter((y) => y !== x) : [...d.shoppingDays, x] })}>{WEEKDAYS_SUN0[x].slice(0, 3)}</button>)}</div>
      </div>
      <button className="btn ghost" onClick={() => run(() => setDoc(doc(db, "config", "app"), DEFAULT_APP_CONFIG), "Réglages de l'appli rétablis")}>Rétablir les réglages par défaut</button>
    </div>
  </div>;
}
