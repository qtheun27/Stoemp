import { useMemo, useState } from "react";
import { ChefHat, ChevronLeft, ChevronRight, Heart, Leaf, RefreshCw, SlidersHorizontal, Sparkles, Check as CheckIcon } from "lucide-react";
import { isVegRecipe, nameOf } from "../lib/catalog";
import { DAYS, SEASONS } from "../lib/constants";
import { mealCostPerPerson } from "../lib/cost";
import { daysToExpiry, planSeason, recipesUsing } from "../lib/planner";
import { mondayOf, shiftWeek, isoWeek } from "../lib/season";
import { eur } from "../lib/text";
import type { Recipe } from "../lib/types";
import { generateWeek, planCtx, saveSlots, setCooked, swapSlot, toggleFavorite } from "../state/actions";
import { useStore } from "../state/store";
import { Empty, run, Stepper, toast, TopBar } from "../ui";
import OptionsSheet from "./Options";
import RecipeSheet from "./Recipe";
import { saveSettings } from "../state/actions";

export default function Week() {
  const s = useStore();
  const [busy, setBusy] = useState<"gen" | number | null>(null);
  const [open, setOpen] = useState<{ r: Recipe; k: number | null } | null>(null);
  const [opts, setOpts] = useState(false);
  const o = s.settings.options;
  const season = planSeason(o);
  const slots = s.week?.slots || [];
  const persons = s.week?.persons || s.settings.persons;
  const ctx = planCtx(s);
  const mon = mondayOf(s.weekKey);
  const todayIdx = s.weekKey === isoWeek() ? (new Date().getDay() + 6) % 7 : -1;

  const costs = useMemo(() => slots.map((sl) => { const r = s.recipes.get(sl.recipeId); return r ? mealCostPerPerson(r, sl.veg, ctx.cost) : 0; }), [slots, s.recipes, s.book, s.settings]);
  const total = costs.reduce((a, b) => a + b, 0) * persons;
  const cooked = slots.filter((x) => x.cooked).length;

  // Bientôt périmé : suggestion de repas pour l'utiliser.
  const expiring = [...s.stock.entries()].filter(([, e]) => e.qty > 0 && daysToExpiry(e) <= 3).map(([id, e]) => ({ id, e, item: s.idx.get(id) })).filter((x) => x.item).slice(0, 3);
  const suggestFor = (itemId: string) => recipesUsing([...s.recipes.values()], itemId).find((r) => !slots.some((x) => x.recipeId === r.id));

  const generate = async () => {
    setBusy("gen");
    if (o.ai) toast("✨ L'IA invente de nouveaux plats…");
    const note = await run(() => generateWeek(s));
    setBusy(null);
    toast(note || (o.ai ? "Semaine générée avec l'IA ✨" : "Semaine générée"));
  };
  const swap = async (k: number) => { setBusy(k); await run(() => swapSlot(s, k, o.ai)); setBusy(null); };
  const placeIn = (r: Recipe) => {
    const k = slots.findIndex((x, i) => !x.cooked && (todayIdx < 0 || x.day >= todayIdx) && i >= 0);
    if (k < 0) return toast("Aucun repas libre cette semaine");
    const sl = [...slots]; sl[k] = { ...sl[k], recipeId: r.id, veg: o.veg && !isVegRecipe(r), cooked: false };
    run(() => saveSlots(s, sl), `« ${r.name} » placé ${DAYS[sl[k].day].toLowerCase()}`);
  };

  const range = `${mon.toLocaleDateString("fr-BE", { day: "numeric", month: "short" })} – ${new Date(mon.getTime() + 6 * 864e5).toLocaleDateString("fr-BE", { day: "numeric", month: "short" })}`;
  return (
    <>
      <TopBar title={`Semaine ${Number(s.weekKey.split("-W")[1])}`} sub={range}>
        <button className="ib" onClick={() => s.setWeekKey(shiftWeek(s.weekKey, -1))} aria-label="Semaine précédente"><ChevronLeft size={20} /></button>
        <button className="ib" onClick={() => s.setWeekKey(shiftWeek(s.weekKey, 1))} aria-label="Semaine suivante"><ChevronRight size={20} /></button>
        <button className="ib" onClick={() => setOpts(true)} aria-label="Options"><SlidersHorizontal size={20} /></button>
      </TopBar>
      <div className="content wide">
        <div className="hero">
          <p className="season">{SEASONS[season].label}</p>
          <p>De saison : {SEASONS[season].produce}</p>
        </div>
        <div className="row wrap" style={{ margin: "14px 0 4px" }}>
          <Stepper value={s.settings.persons} onChange={(v) => saveSettings(s.hid!, { persons: v })} fmt={(v) => `${v} pers.`} />
          <button className="btn ghost" onClick={() => setOpts(true)}><SlidersHorizontal size={18} />Options</button>
          <div className="scroll-x grow" style={{ marginInline: 0, paddingInline: 0 }}>
            {o.seasonal && <span className="tag ac">De saison</span>}{o.local && <span className="tag ac">Région</span>}{o.organic && <span className="tag ac">Bio</span>}
            {o.veg && <span className="tag ac">Végé</span>}{o.budgetOn && <span className="tag ac">≤ {eur(o.budget)}</span>}{o.timeOn && <span className="tag ac">≤ {o.maxTime} min</span>}
            {o.ai && <span className="tag ac">✨ IA</span>}{o.useStock && <span className="tag ac">Écouler le stock</span>}
          </div>
        </div>

        {expiring.map(({ id, e, item }) => {
          const r = suggestFor(id);
          const d = Math.ceil(daysToExpiry(e));
          return <div className="notice" key={id}><span className="grow">⏳ <b>{item!.name}</b> {d <= 0 ? "périme aujourd'hui" : `périme dans ${d} j`}{r ? <> — idée : {r.name}</> : ""}</span>
            {r && <button className="btn sm" onClick={() => placeIn(r)}>Placer</button>}</div>;
        })}
        {s.week?.warning && <div className="notice">{s.week.warning}</div>}

        {!slots.length ? (
          <Empty icon="🍲">Aucun repas prévu pour cette semaine.<br />Règle les options puis génère ta semaine.
            <div style={{ marginTop: 16 }}><button className="btn" disabled={busy === "gen"} onClick={generate}><Sparkles size={18} />{busy === "gen" ? "Je cuisine…" : "Générer ma semaine"}</button></div>
          </Empty>
        ) : (
          <>
            <div className="stats">
              <div className="stat"><b className="num">{eur(total)}</b><span>la semaine</span></div>
              <div className="stat"><b className="num">{eur(total / Math.max(1, slots.length) / persons)}</b><span>par repas et pers.</span></div>
              <div className="stat"><b className="num">{cooked}/{slots.length}</b><span>cuisinés</span></div>
            </div>
            <div className="days">
              {DAYS.map((day, d) => {
                const list = slots.map((x, k) => ({ ...x, k })).filter((x) => x.day === d);
                if (!list.length) return null;
                return (
                  <section key={d} className={`day${d === todayIdx ? " today" : ""}`}>
                    <h3>{day}{d === todayIdx ? " · aujourd'hui" : ""}</h3>
                    {list.map((x) => {
                      const r = s.recipes.get(x.recipeId);
                      if (!r) return <div className="meal" key={x.k}><span className="grow muted">Recette indisponible</span><button className="ib" onClick={() => swap(x.k)}><RefreshCw size={18} /></button></div>;
                      const fav = s.prefs.favorites.includes(r.id);
                      return (
                        <div className={`meal${x.cooked ? " cooked" : ""}`} key={x.k}>
                          <button className="info" onClick={() => setOpen({ r, k: x.k })}>
                            {s.settings.mealsPerDay === 2 && <span className="slot">{x.meal}</span>}
                            <span className="name">{nameOf(r, x.veg)}</span>
                            <span className="meta"><span>⏱ {r.prepMin} min</span><span className="num">{eur(costs[x.k])}/pers.</span>{(isVegRecipe(r) || x.veg) && <span>🌱 végé</span>}{r.source === "ia" && <span>✨ IA</span>}{r.source === "perso" && <span>📝 mon plat</span>}{x.cooked && <span>✅ cuisiné</span>}</span>
                          </button>
                          {!isVegRecipe(r) && <button className="ib" aria-pressed={x.veg} aria-label="Version végétarienne" onClick={() => { const sl = [...slots]; sl[x.k] = { ...x, veg: !x.veg }; delete (sl[x.k] as { k?: number }).k; run(() => saveSlots(s, sl)); }}><Leaf size={18} /></button>}
                          <button className="ib" aria-label="Remplacer ce repas" disabled={busy === x.k} onClick={() => swap(x.k)}><RefreshCw size={18} className={busy === x.k ? "spin" : ""} /></button>
                          <button className="ib hide-xs" aria-label="Favori" aria-pressed={fav} onClick={() => run(() => toggleFavorite(s.hid!, s.prefs, r.id))}><Heart size={18} fill={fav ? "currentColor" : "none"} /></button>
                          <button className="ib" aria-label="Cuisiné" aria-pressed={x.cooked} onClick={() => run(() => setCooked(s, x.k, !x.cooked), x.cooked ? "Stock rétabli" : "Cuisiné : stock mis à jour")}>{x.cooked ? <CheckIcon size={18} /> : <ChefHat size={18} />}</button>
                        </div>
                      );
                    })}
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>
      {!!slots.length && <button className="fab" disabled={busy === "gen"} onClick={generate}><Sparkles size={20} />{busy === "gen" ? "Je cuisine…" : "Nouvelle semaine"}</button>}
      {open && <RecipeSheet recipe={open.r} slotIndex={open.k} onClose={() => setOpen(null)} />}
      {opts && <OptionsSheet onClose={() => setOpts(false)} />}
    </>
  );
}
