import { useState } from "react";
import { Sparkles } from "lucide-react";
import { nameOf } from "../lib/catalog";
import type { Recipe } from "../lib/types";
import { fridgeIdeas, fridgeRecipe } from "../state/actions";
import { useStore } from "../state/store";
import { run, Sheet } from "../ui";

/** « Frigo vide » : plats faisables avec ce qu'il y a à la maison, ou un plat inventé par l'IA avec le stock. */
export default function FridgeSheet({ onClose, onPlace }: { onClose: () => void; onPlace: (r: Recipe) => void }) {
  const s = useStore();
  const ideas = fridgeIdeas(s);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<Recipe | null>(null);
  return <Sheet title="🧊 Frigo vide" sub="Des repas avec ce que tu as déjà à la maison" onClose={onClose}>
    {!s.stock.size && <p className="muted">Ton stock est vide : fais la mise en place rapide dans l'onglet Stock, ou coche tes courses.</p>}
    {!!ideas.length && <div className="list">{ideas.map(({ r, coverage, missing }) => <div key={r.id} className="li">
      <span className="main-t"><span className="name">{nameOf(r, s.settings.options.veg)}</span>
        <span className="meta"><span className="tag ac">{Math.round(coverage * 100)} % en stock</span>{missing.length ? <span>manque : {missing.slice(0, 4).join(", ")}</span> : <span>tout est là ✅</span>}</span></span>
      <button className="btn sm" onClick={() => onPlace(r)}>Placer</button>
    </div>)}</div>}
    {!ideas.length && !!s.stock.size && <p className="muted">Aucune recette de ta base n'est faisable à plus de 50 % avec ton stock.</p>}
    {s.app.features.ai && <>
      <button className="btn ghost block" style={{ marginTop: 14 }} disabled={busy || !s.online || !s.stock.size} onClick={async () => { setBusy(true); const r = await run(() => fridgeRecipe(s)); setBusy(false); if (r) setAi(r); }}>
        <Sparkles size={18} />{busy ? "L'IA cherche une idée…" : "Inventer un plat avec mon stock"}</button>
      {ai && <div className="card" style={{ marginTop: 10 }}><h3>{ai.name}</h3><p>{ai.steps.slice(0, 2).join(" ")}</p><button className="btn sm" onClick={() => onPlace(ai)}>Placer dans la semaine</button></div>}
    </>}
  </Sheet>;
}
