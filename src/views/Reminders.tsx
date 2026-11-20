import { useEffect, useState } from "react";
import { BellOff, BellRing } from "lucide-react";
import { DEFAULT_REMINDERS, disablePush, enablePush, loadDevice, pushSupport, testNotification, updateDevice, type Reminders } from "../state/push";
import { useStore } from "../state/store";
import { Switch, run, toast } from "../ui";

const LINES: { k: keyof Reminders; title: string; desc: string }[] = [
  { k: "courses", title: "🛒 Jour des courses", desc: "Le matin des jours de courses choisis dans Magasins (8 h 30)" },
  { k: "peremption", title: "⏳ Produits qui périment", desc: "Le matin, ce qui est à utiliser aujourd'hui ou demain" },
  { k: "soir", title: "🍽️ Repas du soir", desc: "À 17 h, ou dès 15 h pour un plat long à lancer tôt" },
];

/** Réglages → Rappels sur ce téléphone (chaque membre du foyer choisit pour le sien). */
export function RemindersCard() {
  const s = useStore();
  const uid = s.user!.uid;
  const [dev, setDev] = useState<{ id: string; reminders: Reminders; hid: string } | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const support = pushSupport();
  useEffect(() => { loadDevice(uid).then(setDev).catch(() => setDev(null)); }, [uid]);
  // Le téléphone suit le foyer affiché.
  useEffect(() => { if (dev && s.hid && dev.hid !== s.hid) { updateDevice(uid, dev.id, { hid: s.hid }).catch(() => {}); setDev({ ...dev, hid: s.hid }); } }, [dev, s.hid, uid]);

  const enable = async () => {
    setBusy(true);
    const id = await run(() => enablePush(uid, s.hid!, s.app.vapidKey));
    setBusy(false);
    if (id) { setDev({ id, reminders: DEFAULT_REMINDERS, hid: s.hid! }); testNotification().catch(() => {}); toast("Rappels activés sur ce téléphone"); }
  };
  const toggle = (k: keyof Reminders, v: boolean) => {
    if (!dev) return;
    const reminders = { ...dev.reminders, [k]: v };
    setDev({ ...dev, reminders });
    run(() => updateDevice(uid, dev.id, { reminders }));
  };
  const off = async () => { await run(() => disablePush(uid), "Plus aucun rappel sur ce téléphone"); setDev(null); };

  return (
    <div className="card">
      <h3>🔔 Rappels</h3>
      <p>Sur ce téléphone : le jour des courses, les produits qui périment et le repas du soir. Chaque membre du foyer choisit pour le sien.</p>
      {support === "ios-install" ? (
        <div className="notice"><span className="grow">Sur iPhone, les rappels marchent quand Stoemp est <b>sur l'écran d'accueil</b> : dans Safari, touche Partager <span aria-hidden>⎋</span> → « Sur l'écran d'accueil », puis ouvre Stoemp depuis son icône et reviens ici.</span></div>
      ) : support === "unsupported" ? (
        <p className="small muted">Ce navigateur ne reçoit pas les notifications. Essaie Chrome, Edge ou Firefox, ou Safari avec Stoemp installé sur l'écran d'accueil.</p>
      ) : support === "denied" && !dev ? (
        <div className="notice"><span className="grow">Les notifications sont bloquées pour Stoemp. Autorise-les dans les réglages du téléphone (Notifications → Stoemp), puis reviens ici.</span></div>
      ) : dev === undefined ? (
        <p className="small muted">Chargement…</p>
      ) : !dev ? (
        <button className="btn block" disabled={busy} onClick={enable}><BellRing size={18} />{busy ? "Activation…" : "Activer les rappels sur ce téléphone"}</button>
      ) : (
        <>
          <div className="list" style={{ margin: "4px 0 10px" }}>
            {LINES.map((l) => <label key={l.k} className="li" style={{ cursor: "pointer" }}>
              <span className="main-t"><span className="name">{l.title}</span><span className="meta">{l.desc}</span></span>
              <Switch checked={dev.reminders[l.k]} onChange={(v) => toggle(l.k, v)} label={l.title} />
            </label>)}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost sm" onClick={() => testNotification().catch(() => toast("Notification d'essai impossible sur ce téléphone"))}><BellRing size={16} />Essayer</button>
            <button className="btn ghost sm" onClick={off}><BellOff size={16} />Couper sur ce téléphone</button>
          </div>
        </>
      )}
    </div>
  );
}
