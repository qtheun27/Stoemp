import { useMemo, useState } from "react";
import { Dices, Heart } from "lucide-react";
import { cookable, nameOf } from "../lib/catalog";
import { CUISINES } from "../lib/constants";
import { poolFor } from "../lib/planner";
import { norm } from "../lib/text";
import type { Recipe, Slot } from "../lib/types";
import { setSlotRecipe } from "../state/actions";
import { useStore } from "../state/store";
import { run, Sheet } from "../ui";
import { DishImage } from "./DishImage";

/**
 * Changer le plat d'un repas : recherche dans tout le catalogue (plats qui conviennent à ce repas : complet, léger, déjeuner),
 * favoris d'abord puis cuisines préférées ; « Au hasard » garde le tirage habituel.
 */
export function ChooseDish({ slot, k, onRandom, onClose }: { slot: Slot; k: number; onRandom: () => void; onClose: () => void }) {
  const s = useStore();
  const [q, setQ] = useState("");
  const pool = useMemo(() => poolFor(slot, cookable(s.recipes.values())), [slot, s.recipes]);
  const fav = new Set(s.prefs.favorites), pref = new Set(s.settings.options.cuisines || []);
  const used = new Set((s.week?.slots || []).map((x) => x.recipeId));
  const words = norm(q).split(" ").filter(Boolean);
  const list = pool
    .filter((r) => !words.length || words.every((w) => norm(`${r.name} ${r.vegName || ""} ${r.cuisine || ""}`).includes(w)))
    .map((r) => ({ r, score: (fav.has(r.id) ? 4 : 0) + (r.cuisine && pref.has(r.cuisine) ? 2 : 0) - (used.has(r.id) ? 3 : 0) }))
    .sort((a, b) => b.score - a.score || a.r.name.localeCompare(b.r.name, "fr"))
    .slice(0, 60);
  const choose = (r: Recipe) => { run(() => setSlotRecipe(s, k, r), `« ${nameOf(r, slot.veg)} » au menu`); onClose(); };
  return <Sheet title="Changer ce repas" sub={`${pool.length} plats possibles pour ce repas`} onClose={onClose}>
    <div className="row" style={{ gap: 8 }}>
      <input className="input grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un plat (ex. stoemp, curry, saumon)" aria-label="Chercher un plat" enterKeyHint="search" />
      <button className="btn soft" onClick={() => { onClose(); onRandom(); }} aria-label="Au hasard"><Dices size={18} />Au hasard</button>
    </div>
    <div className="list" style={{ marginTop: 10 }}>
      {list.map(({ r }) => <button key={r.id} className="li" style={{ width: "100%", textAlign: "left", gap: 10, background: "var(--card)", border: 0, borderBottom: "1px solid var(--line)", font: "inherit", color: "inherit", cursor: "pointer" }} onClick={() => choose(r)}>
        <span style={{ width: 52, flex: "none" }}><DishImage recipe={r} idx={s.idx} height={52} rounded={10} thumb /></span>
        <span className="main-t"><span className="name">{nameOf(r, slot.veg)}{fav.has(r.id) && <Heart size={14} style={{ marginLeft: 6, verticalAlign: -2 }} fill="currentColor" />}</span>
          <span className="meta"><span>⏱ {r.prepMin} min</span>{r.cuisine && <span>{CUISINES[r.cuisine as keyof typeof CUISINES]?.label || r.cuisine}</span>}{used.has(r.id) && <span className="tag">déjà cette semaine</span>}</span></span>
      </button>)}
      {!list.length && <p className="small muted">Aucun plat ne correspond. Essaie un autre mot.</p>}
    </div>
  </Sheet>;
}
