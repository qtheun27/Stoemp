import { useMemo, useState } from "react";
import { isVegRecipe } from "../lib/catalog";
import { STORES } from "../lib/constants";
import { allergensOf } from "../lib/planner";
import { bestPrice } from "../lib/pricing";
import { isReadyRecipe, readyPortion } from "../lib/ready";
import { eur, norm } from "../lib/text";
import type { Recipe } from "../lib/types";
import { priceSel } from "../state/actions";
import { useStore } from "../state/store";
import { Sheet } from "../ui";

/** « Soir sans cuisiner » : plats préparés du magasin, au prix réel par portion, filtrés selon le foyer. */
export default function ReadySheet({ onClose, onPick, title = "🥡 Plat préparé" }: { onClose: () => void; onPick: (r: Recipe) => void; title?: string }) {
  const s = useStore();
  const o = s.settings.options;
  const [q, setQ] = useState("");
  const stores = s.settings.stores.length ? s.settings.stores : ["colruyt" as const];
  const list = useMemo(() => [...s.recipes.values()].filter(isReadyRecipe).map((r) => {
    const item = s.idx.get(r.ingredients[0]?.itemId || r.meat[0]?.itemId)!;
    const p = item ? bestPrice(item, stores, s.settings.preferredStore, s.book, priceSel(s)) : null;
    return { r, item, p, portion: p && item ? p.pricePerUnit * readyPortion(item) : null };
  }).filter(({ r, item, p }) => item && p && p.source !== "estimation"
    && !(o.veg && !isVegRecipe(r))
    && !allergensOf(r, false, s.idx).some((a) => o.allergens.includes(a as never))
    && !o.avoid.some((w) => norm(r.name).includes(norm(w)))
  ).sort((a, b) => (a.portion || 0) - (b.portion || 0)), [s.recipes, s.book, s.settings]);
  const shown = q ? list.filter((x) => norm(x.r.name).includes(norm(q))) : list;

  return <Sheet title={title} sub="Prêt à réchauffer · prix de ton magasin par portion" onClose={onClose}>
    <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher (lasagne, pizza, hachis…)" aria-label="Chercher un plat préparé" style={{ marginBottom: 10 }} />
    {!list.length && <p className="muted">Aucun plat préparé avec un prix connu dans tes magasins. Envoie une page « Plats préparés » ou « Traiteur » avec le capteur de prix (Réglages).</p>}
    <div className="list">{shown.slice(0, 60).map(({ r, p, portion }) => <div key={r.id} className="li">
      <span className="main-t"><span className="name">{r.name}</span>
        <span className="meta"><span className="num">{eur(portion || 0)} / portion</span><span>{STORES[p!.store].label}</span>{isVegRecipe(r) && <span>🌱 végé</span>}{p!.promo && <span className="tag ac">promo</span>}</span></span>
      <button className="btn sm" onClick={() => onPick(r)}>Choisir</button>
    </div>)}</div>
    <p className="small muted" style={{ marginTop: 10 }}>Une portion ≈ 350 g (ou la part indiquée sur l'emballage). Ajoute des crudités de saison pour équilibrer.</p>
  </Sheet>;
}
