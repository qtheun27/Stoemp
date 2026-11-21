import { useEffect, useMemo, useRef, useState } from "react";
import { ChefHat, ChevronLeft, ChevronRight, RefreshCw, SlidersHorizontal, Sparkles, Check as CheckIcon } from "lucide-react";
import { cookable, isVegRecipe, nameOf } from "../lib/catalog";
import { CUISINES, DAYS, SEASONS } from "../lib/constants";
import { mealCostPerPerson, partsCost } from "../lib/cost";
import { mealParts, vegPortions } from "../lib/mixed";
import { daysToExpiry, planSeason, recipesUsing } from "../lib/planner";
import { dayOrder, dayPos, shiftWeek, startOf, weekKeyOf, weekNo, weekStartDay } from "../lib/season";
import { YesterdayRating } from "./Tastes";
import { defaultSideLabel, slotRecipe } from "../lib/sides";
import { eur } from "../lib/text";
import type { Recipe } from "../lib/types";
import { fixSides, moveSlot, placeRecipe, removeSlot, restoreSlot, vegCfg, basePortions, generateWeek, planCtx, setCooked, swapSlot } from "../state/actions";
import { ChooseDish } from "./ChooseDish";
import type { Slot } from "../lib/types";
import { coursePortions, eatersLabel, eatersOf, headcount, slotPortions } from "../lib/household";
import { profile, PROTEIN_LABEL, type Protein } from "../lib/balance";
import FridgeSheet from "./Fridge";
import ReadySheet from "./Ready";
import { useStore } from "../state/store";
import { Empty, run, Sheet, toast, TopBar } from "../ui";
import { DishImage } from "./DishImage";
import OptionsSheet from "./Options";
import RecipeSheet from "./Recipe";


export default function Week() {
  const s = useStore();
  const [busy, setBusy] = useState<"gen" | number | null>(null);
  const [open, setOpen] = useState<{ r: Recipe; k: number | null; cook?: boolean } | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const [opts, setOpts] = useState(false);
  const o = s.settings.options;
  const season = planSeason(o);
  const slots = s.week?.slots || [];
  const persons = basePortions(s);
  const eaters = eatersOf(s.settings);
  const ctx = planCtx(s);
  // Semaine du foyer : elle peut commencer un autre jour que le lundi (jour des courses). `slot.day` reste le jour de la semaine (0 = lundi).
  const ws = weekStartDay(s.weekKey), start = startOf(s.weekKey), order = dayOrder(ws);
  const dateOf = (d: number) => new Date(start.getTime() + dayPos(d, ws) * 864e5);
  const todayIdx = s.weekKey === weekKeyOf(new Date(), ws) ? (new Date().getDay() + 6) % 7 : -1;
  const pos = (d: number) => dayPos(d, ws);

  // Coût par portion de chaque plat, et coût total de chaque créneau (invités, restes, entrée/dessert compris).
  // Foyer mixte : parts avec viande et parts végé du même plat.
  const vegP = (sl: (typeof slots)[number]) => vegPortions(sl, vegCfg(s), persons);
  const slotTotals = useMemo(() => slots.map((sl) => { const r = slotRecipe(s.recipes, sl, s.idx); return (r ? partsCost(mealParts(r, sl.veg, slotPortions(sl, persons), vegP(sl), o.allergens), ctx.cost) : 0)
    + (sl.courses || []).reduce((a, c) => { const r = s.recipes.get(c.recipeId); return a + (r ? mealCostPerPerson(r, false, ctx.cost) * coursePortions(sl, persons) : 0); }, 0); }), [slots, persons, s.recipes, s.book, s.settings]);
  const total = slotTotals.reduce((a, b) => a + b, 0);
  const eatenPortions = slots.reduce((a, sl) => a + (sl.fromLeftovers ? persons : slotPortions(sl, persons) - (sl.leftovers ? persons : 0)), 0);
  const balance = useMemo(() => {
    const c: Record<string, number> = {};
    slots.forEach((sl) => { const r = slotRecipe(s.recipes, sl, s.idx); if (r && !sl.fromLeftovers) { const p = profile(r, sl.veg, s.idx).protein; c[p] = (c[p] || 0) + 1; } });
    return c;
  }, [slots, s.recipes]);
  // Semaines déjà prévues : accompagnements remis d'accord avec les règles actuelles (une fois par semaine affichée).
  const fixed = useRef("");
  useEffect(() => { if (s.week?.slots.length && s.recipes.size > 300 && fixed.current !== s.weekKey) { fixed.current = s.weekKey; fixSides(s).catch(() => {}); } }, [s.weekKey, s.week, s.recipes.size]);
  // Ordinateur : glisser un repas sur un autre jour (même moment de la journée ; échange s'il y en a déjà un).
  const [drag, setDrag] = useState<number | null>(null);
  const dropOn = (d: number) => { if (drag == null) return; const sl = slots[drag]; setDrag(null); if (sl && sl.day !== d) run(() => moveSlot(s, drag, d, sl.meal), `Déplacé ${DAYS[d].toLowerCase()}`); };
  const [fridge, setFridge] = useState(false);
  const [ready, setReady] = useState(false);
  const cooked = slots.filter((x) => x.cooked).length;

  // Bientôt périmé : suggestion de repas pour l'utiliser.
  const expiring = [...s.stock.entries()].filter(([, e]) => e.qty > 0 && daysToExpiry(e) <= 3).map(([id, e]) => ({ id, e, item: s.idx.get(id) })).filter((x) => x.item).slice(0, 3);
  const suggestFor = (itemId: string) => recipesUsing(cookable(s.recipes.values()), itemId).find((r) => !slots.some((x) => x.recipeId === r.id));

  // Prochain repas à préparer (à partir de maintenant) : mis en avant en haut de l'écran.
  const RANK = { matin: 0, midi: 1, soir: 2 } as const;
  const nowRank = new Date().getHours() < 10 ? 0 : new Date().getHours() < 15 ? 1 : 2;
  const next = todayIdx < 0 ? undefined : slots.map((x, k) => ({ ...x, k })).filter((x) => !x.cooked && (pos(x.day) > pos(todayIdx) || (x.day === todayIdx && RANK[x.meal] >= nowRank)))
    .sort((a, b) => a.day - b.day || RANK[a.meal] - RANK[b.meal])[0];
  const nextLabel = (x: { day: number; meal: keyof typeof RANK }) => x.day === todayIdx ? { matin: "Ce matin", midi: "Ce midi", soir: "Ce soir" }[x.meal]
    : pos(x.day) === pos(todayIdx) + 1 ? `Demain ${x.meal === "matin" ? "matin" : x.meal}` : `${DAYS[x.day]} ${x.meal}`;
  const sideText = (x: (typeof slots)[number], r: Recipe) => {
    const side = x.side ? s.recipes.get(x.side)?.name.toLowerCase() : defaultSideLabel(r, s.idx);
    const vg = x.vegSide ? s.recipes.get(x.vegSide)?.name.toLowerCase() : null;
    return [side, vg].filter(Boolean).join(", ");
  };
  // Petit retour tactile quand on coche (téléphones qui le permettent).
  const buzz = () => { try { navigator.vibrate?.(10); } catch { /* ignoré */ } };
  const generate = async () => {
    setBusy("gen");
    if (o.ai) toast("✨ L'IA invente de nouveaux plats…");
    const note = await run(() => generateWeek(s));
    setBusy(null);
    toast(note || (o.ai ? "Semaine générée avec l'IA ✨" : "Semaine générée"));
  };
  const swap = async (k: number) => { setBusy(k); await run(() => swapSlot(s, k, o.ai)); setBusy(null); };
  // 🔄 : choisir le nouveau plat dans le catalogue (ou au hasard) ; glisser une carte vers la gauche : retirer le repas (annulable).
  const [choose, setChoose] = useState<number | null>(null);
  const [undo, setUndo] = useState<{ slot: Slot; k: number } | null>(null);
  const remove = async (k: number) => {
    const slot = await run(() => removeSlot(s, k));
    if (slot) { setUndo({ slot, k }); setTimeout(() => setUndo((u) => (u?.slot === slot ? null : u)), 6000); }
  };
  const placeIn = async (r: Recipe) => {
    const d = await run(() => placeRecipe(s, r));
    if (d === null) toast("Aucun repas libre cette semaine : génère d'abord ta semaine");
    else if (d !== undefined) toast(`« ${r.name} » placé ${DAYS[d].toLowerCase()}`);
  };

  const range = `${start.toLocaleDateString("fr-BE", { weekday: "short", day: "numeric", month: "short" })} – ${new Date(start.getTime() + 6 * 864e5).toLocaleDateString("fr-BE", { day: "numeric", month: "short" })}`;
  return (
    <>
      <TopBar title={`Semaine ${weekNo(s.weekKey)}`} sub={range}>
        <button className="ib" onClick={() => s.setWeekKey(shiftWeek(s.weekKey, -1))} aria-label="Semaine précédente"><ChevronLeft size={20} /></button>
        <button className="ib" onClick={() => s.setWeekKey(shiftWeek(s.weekKey, 1))} aria-label="Semaine suivante"><ChevronRight size={20} /></button>
        {!!slots.length && <button className="ib" onClick={() => setConfirmNew(true)} disabled={busy === "gen"} aria-label="Nouvelle semaine"><Sparkles size={20} className={busy === "gen" ? "spin" : ""} /></button>}
        <button className="ib" onClick={() => setOpts(true)} aria-label="Options"><SlidersHorizontal size={20} /></button>
      </TopBar>
      <div className="content wide">
        {/* Saison en une ligne, puis raccourcis à faire défiler du pouce. */}
        <button className="season-line" onClick={() => setOpts(true)}>{SEASONS[season].icon} <b>{SEASONS[season].label}</b> · {SEASONS[season].produce}</button>
        {(() => {
          const tags = [o.seasonal && "De saison", o.local && "Région", o.organic && "Bio", o.veg && "Végé", o.budgetOn && `≤ ${eur(o.budget)}`, o.timeOn && `≤ ${o.maxTime} min`,
            o.ai && "✨ IA", o.useStock && "Écouler le stock", ...(o.cuisines || []).map((c) => `${CUISINES[c].icon} ${CUISINES[c].label}`)].filter(Boolean) as string[];
          return <div className="scroller" role="toolbar" aria-label="Raccourcis">
            <button className="chip big" onClick={() => setOpts(true)} aria-label="Composition du foyer et options">👨‍👩‍👧 {eatersLabel(eaters)}{vegCfg(s).vegEaters ? ` · ${vegCfg(s).vegEaters} 🌱` : ""}</button>
            <button className="chip big" onClick={() => setOpts(true)}><SlidersHorizontal size={16} />Options{tags.length ? ` · ${tags.length}` : ""}</button>
            <button className="chip big" onClick={() => setFridge(true)}>🧊 Frigo vide</button>
            <button className="chip big" onClick={() => setReady(true)}>🥡 Sans cuisiner</button>
          </div>;
        })()}

        {expiring.map(({ id, e, item }) => {
          const r = suggestFor(id);
          const d = Math.ceil(daysToExpiry(e));
          return <div className="notice" key={id}><span className="grow">⏳ <b>{item!.name}</b> {d <= 0 ? "périme aujourd'hui" : `périme dans ${d} j`}{r ? <> — idée : {r.name}</> : ""}</span>
            {r && <button className="btn sm" onClick={() => placeIn(r)}>Placer</button>}</div>;
        })}
        {s.week?.warning && <div className="notice">{s.week.warning}</div>}
        {todayIdx >= 0 && pos(todayIdx) > 0 && <YesterdayRating recipeIds={slots.filter((x) => x.day === (todayIdx + 6) % 7 && !x.fromLeftovers).map((x) => x.recipeId)} />}

        {!slots.length ? (
          <Empty icon="🍲">Aucun repas prévu pour cette semaine.<br />Règle les options puis génère ta semaine.
            <div style={{ marginTop: 16 }}><button className="btn" disabled={busy === "gen"} onClick={generate}><Sparkles size={18} />{busy === "gen" ? "Je cuisine…" : "Générer ma semaine"}</button></div>
          </Empty>
        ) : (
          <>
            {next && (() => {
              const base = s.recipes.get(next.recipeId), r = slotRecipe(s.recipes, next, s.idx);
              if (!base || !r) return null;
              return <div className="next-meal">
                <button className="next-img" onClick={() => setOpen({ r: base, k: next.k })} aria-label={`Voir la recette : ${base.name}`}><DishImage recipe={base} idx={s.idx} height={168} rounded={0} /></button>
                <div className="next-body">
                  <span className="slot">{nextLabel(next)}</span>
                  <button className="next-name" onClick={() => setOpen({ r: base, k: next.k })}>{nameOf(base, next.veg)}{sideText(next, base) && <span className="muted"> · {sideText(next, base)}</span>}</button>
                  <span className="meta"><span>⏱ {r.prepMin} min</span>{!next.fromLeftovers && <span className="num">{eur(slotTotals[next.k])}</span>}{next.fromLeftovers && <span>restes 🍱</span>}</span>
                  <div className="next-acts">
                    {r.source !== "pret" && !next.fromLeftovers && <button className="btn" onClick={() => setOpen({ r: base, k: next.k, cook: true })}><ChefHat size={18} />Cuisiner</button>}
                    <button className="btn ghost" onClick={() => { buzz(); run(() => setCooked(s, next.k, true), "Bon appétit ! Stock mis à jour"); }}><CheckIcon size={18} />C'est fait</button>
                  </div>
                </div>
              </div>;
            })()}
            <div className="daystrip" role="tablist" aria-label="Jours de la semaine">
              {order.map((d) => {
                const label = DAYS[d], list = slots.filter((x) => x.day === d), done = list.length > 0 && list.every((x) => x.cooked);
                return <button key={d} className={`dchip${d === todayIdx ? " today" : ""}${done ? " done" : ""}`} disabled={!list.length} aria-label={`${label}${list.length ? `, ${list.length} repas` : ", aucun repas"}`}
                  onClick={() => document.getElementById(`day-${d}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                  <span>{label.slice(0, 2)}</span><b>{dateOf(d).getDate()}</b><i aria-hidden>{done ? "✓" : list.length ? "•".repeat(Math.min(3, list.length)) : ""}</i></button>;
              })}
            </div>
            <div className="weekline">
              <span><b className="num">{eur(total)}</b> la semaine</span><span><b className="num">{eur(total / Math.max(1, eatenPortions))}</b> / portion</span><span><b>{cooked}/{slots.length}</b> cuisinés</span>
            </div>
            {o.balance !== false && <div className="chips" style={{ margin: "0 0 12px" }} aria-label="Équilibre de la semaine">
              {(Object.keys(PROTEIN_LABEL) as Protein[]).filter((k) => balance[k]).map((k) => <span key={k} className="tag">{PROTEIN_LABEL[k]} × {balance[k]}</span>)}
              {!balance.poisson && !o.veg && !o.allergens.includes("po") && <span className="tag warn">pas de poisson cette semaine</span>}
            </div>}
            <div className="days">
              {order.map((d) => {
                const day = DAYS[d], list = slots.map((x, k) => ({ ...x, k })).filter((x) => x.day === d);
                if (!list.length) return null;
                return (
                  <section key={d} id={`day-${d}`} className={`day${d === todayIdx ? " today" : ""}`} onDragOver={(e) => drag != null && e.preventDefault()} onDrop={() => dropOn(d)}>
                    <h3>{day}{d === todayIdx ? " · aujourd'hui" : ""}</h3>
                    {list.map((x) => {
                      const r = s.recipes.get(x.recipeId);
                      if (!r) return <div className="meal" key={x.k}><span className="grow muted">Recette indisponible</span><button className="ib" onClick={() => swap(x.k)}><RefreshCw size={18} /></button></div>;
                      return (
                        <SwipeActions key={x.k} label={`${r.name} : glisser pour changer ou retirer`} onChange={() => setChoose(x.k)} onRemove={() => remove(x.k)}>
                        <div className={`meal${x.cooked ? " cooked" : ""}`} draggable={!x.fromLeftovers && !x.leftovers} onDragStart={() => setDrag(x.k)} onDragEnd={() => setDrag(null)}>
                          <button className="thumb" tabIndex={-1} aria-hidden onClick={() => setOpen({ r, k: x.k })}><DishImage recipe={r} idx={s.idx} height={64} rounded={12} thumb /></button>
                          <button className="info" onClick={() => setOpen({ r, k: x.k })}>
                            <span className="slot">{x.meal === "matin" ? "☕ déjeuner" : `${x.meal} · ${x.light ? "🥗 léger" : "🍲 complet"}`}</span>
                            <span className="name">{nameOf(r, x.veg)}{sideText(x, r) && <span className="muted"> · {sideText(x, r)}</span>}</span>
                            {x.guests && <span className="tag ac" style={{ marginBottom: 4 }}>🎉 réception · {headcount(eaters) + x.guests.adults + x.guests.kids} pers.{x.courses?.length ? ` · ${x.courses.length + 1} services` : ""}</span>}
                            <span className="meta">{r.source === "pret" ? <span>🥡 plat préparé</span> : <span>⏱ {r.prepMin} min</span>}<span className="num">{x.fromLeftovers ? "restes 🍱" : `${eur(slotTotals[x.k])}`}</span>{x.leftovers && <span>🍱 + demain midi</span>}{!x.fromLeftovers && r.source !== "pret" && !isVegRecipe(r) && vegP(x) > 0 && <span>🌱 {vegP(x)} végé</span>}
                              {(isVegRecipe(r) || (x.veg && r.source !== "pret")) && <span>🌱 végé</span>}{r.source === "ia" && <span>✨ IA</span>}{r.source === "perso" && <span>📝 mon plat</span>}</span>
                          </button>
                          <button className={`ib done${x.cooked ? " on" : ""}`} aria-label={x.cooked ? "Annuler « cuisiné »" : "Marquer comme cuisiné"} aria-pressed={x.cooked}
                            onClick={() => { buzz(); run(() => setCooked(s, x.k, !x.cooked), x.cooked ? "Stock rétabli" : "Cuisiné : stock mis à jour"); }}><CheckIcon size={19} /></button>
                        </div>
                        </SwipeActions>
                      );
                    })}
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>
      {choose != null && slots[choose] && <ChooseDish slot={slots[choose]} k={choose} onRandom={() => swap(choose)} onClose={() => setChoose(null)} />}
      {undo && <div className="undo-bar" role="status"><span className="grow">Repas retiré</span>
        <button className="btn soft sm" onClick={() => { const u = undo; setUndo(null); run(() => restoreSlot(s, u.slot, u.k), "Repas remis"); }}>Annuler</button></div>}
      {confirmNew && <Sheet title="Nouvelle semaine ?" onClose={() => setConfirmNew(false)}>
        <p>Tous les repas de la semaine {weekNo(s.weekKey)} seront remplacés par une nouvelle proposition{cooked ? ` (dont ${cooked} déjà cuisiné${cooked > 1 ? "s" : ""})` : ""}. Tes favoris, tes goûts et tes accords d'accompagnement restent.</p>
        <p className="small muted">Pour changer ou retirer un seul repas, glisse plutôt sa carte vers la gauche.</p>
        <div className="stack" style={{ gap: 8, marginTop: 12 }}>
          <button className="btn block" onClick={() => { setConfirmNew(false); generate(); }}><Sparkles size={18} />Remplacer toute la semaine</button>
          <button className="btn ghost block" onClick={() => setConfirmNew(false)}>Garder ma semaine</button>
        </div>
      </Sheet>}
      {open && <RecipeSheet recipe={open.r} slotIndex={open.k} startCook={open.cook} onClose={() => setOpen(null)} />}
      {opts && <OptionsSheet onClose={() => setOpts(false)} />}
      {ready && <ReadySheet onClose={() => setReady(false)} onPick={(r) => { placeIn(r); setReady(false); }} />}
      {fridge && <FridgeSheet onClose={() => setFridge(false)} onPlace={(r) => { placeIn(r); setFridge(false); }} />}
    </>
  );
}

/**
 * Carte qu'on glisse vers la gauche. Lâchée à mi-course : elle reste ouverte sur « Changer » et « Retirer ».
 * Glissée jusqu'au bout sans lâcher (plus de 60 % de sa largeur) : le repas est retiré. Sinon elle revient en place.
 */
const OPEN = 176;
function SwipeActions({ children, onChange, onRemove, label }: { children: React.ReactNode; onChange: () => void; onRemove: () => void; label: string }) {
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; base: number; on: boolean } | null>(null);
  const width = () => box.current?.offsetWidth || 360;
  const far = dx < -width() * 0.6;
  const close = () => setDx(0);
  return <div className="swipe" ref={box} aria-label={label}>
    <div className={`swipe-bg${far ? " far" : ""}`}>
      {far ? <span className="swipe-far">Relâche pour retirer</span> : <>
        <button className="swipe-act change" onClick={() => { close(); onChange(); }}><RefreshCw size={18} />Changer</button>
        <button className="swipe-act remove" onClick={() => { close(); onRemove(); }}>Retirer</button>
      </>}
    </div>
    <div className="swipe-fg" style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: drag ? "none" : "transform .22s" }}
      onClickCapture={(e) => { if (dx) { e.stopPropagation(); e.preventDefault(); close(); } }}
      onTouchStart={(e) => { start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, base: dx, on: false }; }}
      onTouchMove={(e) => {
        const st = start.current; if (!st) return;
        const mx = e.touches[0].clientX - st.x, my = e.touches[0].clientY - st.y;
        if (!st.on && Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.5) { st.on = true; setDrag(true); } // geste horizontal seulement
        if (st.on) setDx(Math.min(0, st.base + mx));
      }}
      onTouchEnd={() => {
        const st = start.current; start.current = null; setDrag(false);
        if (!st?.on) return;
        if (dx < -width() * 0.6) { try { navigator.vibrate?.(15); } catch { /* ignoré */ } setDx(-width() - 20); setTimeout(() => { setDx(0); onRemove(); }, 200); }
        else setDx(dx < -50 ? -OPEN : 0);
      }}>
      {children}
    </div>
  </div>;
}
