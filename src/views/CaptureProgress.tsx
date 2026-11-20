import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { STORES } from "../lib/constants";
import type { StoreId } from "../lib/types";
import { useStore } from "../state/store";

interface Progress { id: string; store: StoreId; page?: string; pos: number; total: number; prices?: number; paused?: string | null; at: number; doneAt?: number | null }

/** Avancement en direct du classement en arrière-plan des produits inconnus envoyés par le capteur (fiches `enrichProgress`). */
export function CaptureProgress() {
  const s = useStore();
  const [list, setList] = useState<Progress[]>([]);
  useEffect(() => {
    if (!s.user) return;
    return onSnapshot(query(collection(db, "enrichProgress"), where("uid", "==", s.user.uid)),
      (q) => setList(q.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Progress, "id">) }))), () => setList([]));
  }, [s.user]);
  // Envois en cours, et ceux terminés depuis moins de 6 h.
  const shown = list.filter((p) => !p.doneAt || Date.now() - p.doneAt < 6 * 3600_000).sort((a, b) => b.at - a.at).slice(0, 3);
  if (!shown.length) return null;
  return <div className="stack" style={{ gap: 8 }}>{shown.map((p) => {
    const pct = Math.round((Math.min(p.pos, p.total) / Math.max(1, p.total)) * 100);
    const left = Math.max(0, p.total - p.pos);
    return <div key={p.id} className="notice" style={{ display: "block" }}>
      <div className="row between"><b>{p.doneAt ? "✓" : p.paused ? "⏸" : "⏳"} {STORES[p.store]?.label || p.store}{p.page ? ` · ${p.page}` : ""}</b><span className="small num">{Math.min(p.pos, p.total)} / {p.total} produits classés · envoyé à {new Date(p.at).toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })}</span></div>
      <div className="progress" style={{ margin: "6px 0" }}><i style={{ width: `${pct}%` }} /></div>
      <div className="small muted">{p.doneAt ? `Terminé : ${p.prices || 0} prix ajoutés en arrière-plan.`
        : p.paused ? "En pause : budget IA du mois atteint. Reprise automatique dès qu'il est relevé (console → IA)."
        : `Encore environ ${Math.max(1, Math.ceil(left / 200) * 2)} min · ${p.prices || 0} prix ajoutés pour l'instant. Tu peux fermer l'appli.`}</div>
    </div>;
  })}</div>;
}
