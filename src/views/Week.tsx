import { useEffect, useMemo, useState } from "react";
import { ChefHat, ChevronLeft, ChevronRight, Heart, Leaf, RefreshCw, SlidersHorizontal, Sparkles, Check as CheckIcon } from "lucide-react";
import { cookable, isVegRecipe, nameOf } from "../lib/catalog";
import { CUISINES, DAYS, SEASONS } from "../lib/constants";
import { mealCostPerPerson, partsCost } from "../lib/cost";
import { mealParts, vegPortions } from "../lib/mixed";
import { daysToExpiry, mealCounts, planSeason, recipesUsing } from "../lib/planner";
import { mondayOf, shiftWeek, isoWeek } from "../lib/season";
import { YesterdayRating } from "./Tastes";
import { eur } from "../lib/text";
import type { Recipe } from "../lib/types";
import { placeRecipe, vegCfg, basePortions, generateWeek, planCtx, saveSlots, setCooked, swapSlot, toggleFavorite } from "../state/actions";
import { coursePortions, eatersLabel, eatersOf, headcount, slotPortions } from "../lib/household";
import { profile, PROTEIN_LABEL, type Protein } from "../lib/balance";
import { drinkFor } from "../lib/drinks";
import FridgeSheet from "./Fridge";
import ReadySheet from "./Ready";
import { useStore } from "../state/store";
import { Empty, run, toast, TopBar } from "../ui";
import OptionsSheet from "./Options";
import RecipeSheet from "./Recipe";


export default function Week() {
  const s = useStore();
  const [busy, setBusy] = useState<"gen" | number | null>(null);
  const [open, setOpen] = useState<{ r: Recipe; k: number | null } | null>(null);
  const [opts, setOpts] = useState(false);
  const o = s.settings.options;
  const season = planSeason(o);
  const slots = s.week?.slots || [];
  const persons = basePortions(s);
  const eaters = eatersOf(s.settings);
  const ctx = planCtx(s);
  const mon = mondayOf(s.weekKey);
  const todayIdx = s.weekKey === isoWeek() ? (new Date().getDay() + 6) % 7 : -1;

  // Coût par portion de chaque plat, et coût total de chaque créneau (invités, restes, entrée/dessert compris).
  // Foyer mixte : parts avec viande et parts végé du même plat.
  const vegP = (sl: (typeof slots)[number]) => vegPortions(sl, vegCfg(s), persons);
  const slotTotals = useMemo(() => slots.map((sl) => { const r = s.recipes.get(sl.recipeId); return (r ? partsCost(mealParts(r, sl.veg, slotPortions(sl, persons), vegP(sl), o.allergens), ctx.cost) : 0)
    + (sl.courses || []).reduce((a, c) => { const r = s.recipes.get(c.recipeId); return a + (r ? mealCostPerPerson(r, false, ctx.cost) * coursePortions(sl, persons) : 0); }, 0); }), [slots, persons, s.recipes, s.book, s.settings]);
  const total = slotTotals.reduce((a, b) => a + b, 0);
  const eatenPortions = slots.reduce((a, sl) => a + (sl.fromLeftovers ? persons : slotPortions(sl, persons) - (sl.leftovers ? persons : 0)), 0);
  const balance = useMemo(() => {
    const c: Record<string, number> = {};
    slots.forEach((sl) => { const r = s.recipes.get(sl.recipeId); if (r && !sl.fromLeftovers) { const p = profile(r, sl.veg, s.idx).protein; c[p] = (c[p] || 0) + 1; } });
    return c;
  }, [slots, s.recipes]);
  const [fridge, setFridge] = useState(false);
  const [ready, setReady] = useState(false);
  // Bouton « Nouvelle semaine » réduit à l'icône dès qu'on fait défiler la liste.
  const [mini, setMini] = useState(false);
  useEffect(() => { const f = () => setMini(scrollY > 160); f(); addEventListener("scroll", f, { passive: true }); return () => removeEventListener("scroll", f); }, []);
  const cooked = slots.filter((x) => x.cooked).length;

  // Bientôt périmé : suggestion de repas pour l'utiliser.
  const expiring = [...s.stock.entries()].filter(([, e]) => e.qty > 0 && daysToExpiry(e) <= 3).map(([id, e]) => ({ id, e, item: s.idx.get(id) })).filter((x) => x.item).slice(0, 3);
  const suggestFor = (itemId: string) => recipesUsing(cookable(s.recipes.values()), itemId).find((r) => !slots.some((x) => x.recipeId === r.id));

  const generate = async () => {
    setBusy("gen");
    if (o.ai) toast("✨ L'IA invente de nouveaux plats…");
    const note = await run(() => generateWeek(s));
    setBusy(null);
    toast(note || (o.ai ? "Semaine générée avec l'IA ✨" : "Semaine générée"));
  };
  const swap = async (k: number) => { setBusy(k); await run(() => swapSlot(s, k, o.ai)); setBusy(null); };
  const placeIn = async (r: Recipe) => {
    const d = await run(() => placeRecipe(s, r));
    if (d === null) toast("Aucun repas libre cette semaine : génère d'abord ta semaine");
    else if (d !== undefined) toast(`« ${r.name} » placé ${DAYS[d].toLowerCase()}`);
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
        <div className="quick">
          <button className="btn ghost" onClick={() => setOpts(true)} aria-label="Composition du foyer">👨‍👩‍👧 {eatersLabel(eaters)}{vegCfg(s).vegEaters ? ` · ${vegCfg(s).vegEaters} 🌱` : ""}</button>
          <button className="btn ghost" onClick={() => setOpts(true)}><SlidersHorizontal size={18} />Options</button>
          <button className="btn ghost" onClick={() => setFridge(true)}>🧊 Frigo vide</button>
          <button className="btn ghost" onClick={() => setReady(true)}>🥡 Sans cuisiner</button>
        </div>
        {(() => {
          const tags = [o.seasonal && "De saison", o.local && "Région", o.organic && "Bio", o.veg && "Végé", o.budgetOn && `≤ ${eur(o.budget)}`, o.timeOn && `≤ ${o.maxTime} min`,
            o.ai && "✨ IA", o.useStock && "Écouler le stock", ...(o.cuisines || []).map((c) => `${CUISINES[c].icon} ${CUISINES[c].label}`)].filter(Boolean) as string[];
          return tags.length ? <button className="chips tags-line" onClick={() => setOpts(true)} aria-label="Options actives">{tags.map((t) => <span key={t} className="tag ac">{t}</span>)}</button> : null;
        })()}

        {expiring.map(({ id, e, item }) => {
          const r = suggestFor(id);
          const d = Math.ceil(daysToExpiry(e));
          return <div className="notice" key={id}><span className="grow">⏳ <b>{item!.name}</b> {d <= 0 ? "périme aujourd'hui" : `périme dans ${d} j`}{r ? <> — idée : {r.name}</> : ""}</span>
            {r && <button className="btn sm" onClick={() => placeIn(r)}>Placer</button>}</div>;
        })}
        {s.week?.warning && <div className="notice">{s.week.warning}</div>}
        {todayIdx > 0 && <YesterdayRating recipeIds={slots.filter((x) => x.day === todayIdx - 1 && !x.fromLeftovers).map((x) => x.recipeId)} />}

        {!slots.length ? (
          <Empty icon="🍲">Aucun repas prévu pour cette semaine.<br />Règle les options puis génère ta semaine.
            <div style={{ marginTop: 16 }}><button className="btn" disabled={busy === "gen"} onClick={generate}><Sparkles size={18} />{busy === "gen" ? "Je cuisine…" : "Générer ma semaine"}</button></div>
          </Empty>
        ) : (
          <>
            <div className="stats">
              <div className="stat"><b className="num">{eur(total)}</b><span>la semaine</span></div>
              <div className="stat"><b className="num">{eur(total / Math.max(1, eatenPortions))}</b><span>par repas et portion</span></div>
              <div className="stat"><b className="num">{cooked}/{slots.length}</b><span>cuisinés</span></div>
            </div>
            {o.balance !== false && <div className="chips" style={{ margin: "-4px 0 12px" }} aria-label="Équilibre de la semaine">
              {(Object.keys(PROTEIN_LABEL) as Protein[]).filter((k) => balance[k]).map((k) => <span key={k} className="tag">{PROTEIN_LABEL[k]} × {balance[k]}</span>)}
              {!balance.poisson && !o.veg && !o.allergens.includes("po") && <span className="tag warn">pas de poisson cette semaine</span>}
            </div>}
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
                            {list.length > 1 || mealCounts(s.settings).lunches > 0 ? <span className="slot">{x.meal}</span> : null}
                            <span className="name">{nameOf(r, x.veg)}</span>
                            {x.guests && <span className="tag ac" style={{ marginBottom: 4 }}>🎉 réception · {headcount(eaters) + x.guests.adults + x.guests.kids} pers.{x.courses?.length ? ` · ${x.courses.length + 1} services` : ""}</span>}
                            <span className="meta">{r.source === "pret" ? <span>🥡 plat préparé</span> : <span>⏱ {r.prepMin} min</span>}<span className="num">{x.fromLeftovers ? "restes 🍱" : `${eur(slotTotals[x.k])}`}</span>{x.leftovers && <span>🍱 + demain midi</span>}{!x.fromLeftovers && r.source !== "pret" && !isVegRecipe(r) && vegP(x) > 0 && <span>🌱 {vegP(x)} part{vegP(x) > 1 ? "s" : ""} végé</span>}
                            {o.drinks !== false && !x.fromLeftovers && <span>{x.drinks?.length ? `🍷 ${x.drinks[0]}` : `🍷 ${drinkFor(r, x.veg, s.idx, !!o.noAlcohol).adult}`}</span>}{(isVegRecipe(r) || (x.veg && r.source !== "pret")) && <span>🌱 végé</span>}{r.source === "ia" && <span>✨ IA</span>}{r.source === "perso" && <span>📝 mon plat</span>}{x.cooked && <span>✅ cuisiné</span>}</span>
                          </button>
                          {!isVegRecipe(r) && r.source !== "pret" && <button className="ib" aria-pressed={x.veg} aria-label="Version végétarienne" onClick={() => { const sl = [...slots]; sl[x.k] = { ...x, veg: !x.veg }; delete (sl[x.k] as { k?: number }).k; run(() => saveSlots(s, sl)); }}><Leaf size={18} /></button>}
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
      {!!slots.length && <button className={`fab${mini && busy !== "gen" ? " mini" : ""}`} disabled={busy === "gen"} onClick={generate} aria-label="Nouvelle semaine"><Sparkles size={20} /><span className="lbl">{busy === "gen" ? "Je cuisine…" : "Nouvelle semaine"}</span></button>}
      {open && <RecipeSheet recipe={open.r} slotIndex={open.k} onClose={() => setOpen(null)} />}
      {opts && <OptionsSheet onClose={() => setOpts(false)} />}
      {ready && <ReadySheet onClose={() => setReady(false)} onPick={(r) => { placeIn(r); setReady(false); }} />}
      {fridge && <FridgeSheet onClose={() => setFridge(false)} onPlace={(r) => { placeIn(r); setFridge(false); }} />}
    </>
  );
}
