import { useState } from "react";
import { ALLERGENS, CUISINES, CUISINE_ORDER, DAYS, SEASONS, SEASON_ORDER } from "../lib/constants";
import type { Allergen, GenOptions, Settings } from "../lib/types";
import { saveSettings } from "../state/actions";
import { mealDays } from "../lib/planner";
import { eatersOf, headcount, type Eaters } from "../lib/household";
import { useStore } from "../state/store";
import { Check, Sheet, Stepper } from "../ui";

type OptProps = { o: GenOptions; set: (p: Partial<GenOptions>) => void; k: keyof GenOptions; title: string; desc?: string; children?: React.ReactNode };
function Opt({ o, set, k, title, desc, children }: OptProps) {
  return (
    <div className="opt">
      <Check checked={!!o[k]} onChange={(v) => set({ [k]: v } as Partial<GenOptions>)} label={title} />
      <div className="t"><b>{title}</b>{desc && <div className="d">{desc}</div>}{o[k] && children && <div className="extra">{children}</div>}</div>
    </div>
  );
}

/** Écran « Options » : cases à cocher combinables, mémorisées par foyer. */
export default function OptionsSheet({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const o = s.settings.options;
  const [avoid, setAvoid] = useState("");
  const set = (patch: Partial<GenOptions>) => saveSettings(s.hid!, { options: { ...o, ...patch } });
  const setS = (patch: Partial<Settings>) => saveSettings(s.hid!, patch);
  const days = mealDays(s.settings);
  const light = new Set(s.settings.lightSlots || []);
  // Midi / soir : une touche fait passer le jour de « pas de repas » à « complet », puis « léger », puis « pas de repas ».
  const cycleDay = (meal: "lunch" | "dinner", d: number) => {
    const key = `${d}-${meal === "lunch" ? "midi" : "soir"}`, on = days[meal].includes(d);
    const nextLight = new Set(light);
    let list = days[meal];
    if (!on) list = [...list, d].sort((a, b) => a - b);
    else if (!light.has(key)) nextLight.add(key);
    else { list = list.filter((x) => x !== d); nextLight.delete(key); }
    const next = { ...days, [meal]: list };
    if (!next.lunch.length && !next.dinner.length) return;
    setS({ lunchDays: next.lunch, dinnerDays: next.dinner, lunches: next.lunch.length, dinners: next.dinner.length, lightSlots: [...nextLight] });
  };
  const toggleBreakfast = (d: number) => setS({ breakfastDays: days.breakfast.includes(d) ? days.breakfast.filter((x) => x !== d) : [...days.breakfast, d].sort((a, b) => a - b) });
  const e = eatersOf(s.settings);
  const setEaters = (x: Eaters) => setS({ adults: x.adults, teens: x.teens, kids: x.kids, persons: headcount(x) });
  const mine = [...s.recipes.values()].filter((r) => r.source === "perso" && !r.deleted).length;
  return (
    <Sheet title="Options" sub="Elles s'appliquent à la prochaine génération" onClose={onClose}>
      {/* Foyer : trois compteurs sur une ligne. */}
      <div className="eaters">
        <div><div className="small muted">Adultes</div><Stepper value={e.adults} min={1} max={12} onChange={(v) => setEaters({ ...e, adults: v })} /></div>
        <div><div className="small muted">Ados <span className="tiny">11-17</span></div><Stepper value={e.teens} min={0} max={8} onChange={(v) => setEaters({ ...e, teens: v })} /></div>
        <div><div className="small muted">Enfants <span className="tiny">3-10</span></div><Stepper value={e.kids} min={0} max={8} onChange={(v) => setEaters({ ...e, kids: v })} /></div>
      </div>
      {/* Repas de la semaine : une grille comme un calendrier. Une touche par case : complet 🍲 → léger 🥗 → rien. */}
      <div className="mealgrid" role="grid" aria-label="Repas de la semaine">
        <span />{DAYS.map((label) => <span key={label} className="mg-day">{label.slice(0, 1)}</span>)}
        <span className="mg-row">☕ Déj.</span>
        {DAYS.map((label, d) => { const on = days.breakfast.includes(d);
          return <button key={d} className={`mg-cell${on ? " on" : ""}`} aria-pressed={on} aria-label={`${label} déjeuner du matin : ${on ? "oui" : "non"}`} onClick={() => toggleBreakfast(d)}>{on ? "☕" : ""}</button>; })}
        {(["lunch", "dinner"] as const).map((meal) => [
          <span key={meal} className="mg-row">{meal === "lunch" ? "Midi" : "Soir"}</span>,
          ...DAYS.map((label, d) => { const on = days[meal].includes(d), lt = on && light.has(`${d}-${meal === "lunch" ? "midi" : "soir"}`);
            return <button key={meal + d} className={`mg-cell${on ? " on" : ""}${lt ? " light" : ""}`} aria-pressed={on}
              aria-label={`${label} ${meal === "lunch" ? "midi" : "soir"} : ${!on ? "pas de repas" : lt ? "repas léger" : "repas complet"}`} onClick={() => cycleDay(meal, d)}>{on ? (lt ? "🥗" : "🍲") : ""}</button>; }),
        ])}
      </div>
      <div className="small muted" style={{ margin: "6px 0 14px" }}>Une touche par case : 🍲 repas complet → 🥗 léger → rien. ☕ = une recette de déjeuner (conseillé le week-end ; en semaine, le stock prévoit pain, lait…). {days.lunch.length + days.dinner.length} repas{days.breakfast.length ? ` + ${days.breakfast.length} déjeuner${days.breakfast.length > 1 ? "s" : ""}` : ""} par semaine.</div>
      <Opt o={o} set={set} k="seasonal" title="De saison" desc="Mois courant, ou saison choisie">
        <div className="chips">
          <button className="chip" aria-pressed={o.season === "auto"} onClick={() => set({ season: "auto" })}>Mois courant</button>
          {SEASON_ORDER.map((k) => <button key={k} className="chip" aria-pressed={o.season === k} onClick={() => set({ season: k })}>{SEASONS[k].icon} {SEASONS[k].label}</button>)}
        </div>
      </Opt>
      <Opt o={o} set={set} k="local" title="Produits de la région" desc="Ingrédients principaux produits en Belgique, substitutions locales proposées" />
      <Opt o={o} set={set} k="organic" title="Bio" desc="Prix bio quand ils existent ; les articles sans version bio sont signalés" />
      <Opt o={o} set={set} k="veg" title="Végétarien" desc="Tous les repas en version végé (chaque repas garde son bouton 🌱)" />
      {!o.veg && <div className="opt"><span style={{ width: 26 }} /><div className="t"><b>Foyer mixte</b>
        <div className="d">Un seul plat pour tout le monde : pour les végétariens, la viande est remplacée par une protéine végétale (lentilles, pois chiches, œufs…) — même sauce, mêmes accompagnements.</div>
        <div className="row extra"><span className="grow small">Dont végétariens</span><Stepper value={Math.min(s.settings.vegEaters || 0, headcount(e))} min={0} max={headcount(e)} onChange={(v) => setS({ vegEaters: v })} /></div></div></div>}
      <div className="opt"><span style={{ width: 26 }} /><div className="t"><b>Cuisines préférées</b><div className="d">Elles reviennent plus souvent dans la semaine ; aucune cochée = toutes, à parts égales</div>
        <div className="chips extra">{CUISINE_ORDER.map((c) => { const on = (o.cuisines || []).includes(c);
          return <button key={c} className="chip" aria-pressed={on} onClick={() => set({ cuisines: on ? (o.cuisines || []).filter((x) => x !== c) : [...(o.cuisines || []), c] })}>{CUISINES[c].icon} {CUISINES[c].label}</button>; })}</div></div></div>
      <div className="opt"><span style={{ width: 26 }} /><div className="t"><b>Gamme de produits</b><div className="d">Sert au coût des repas et au budget, quand tu n'as pas encore de prix payés</div>
        <div className="chips extra">{([["eco", "Premier prix"], ["maison", "Marque du magasin"], ["marque", "Grandes marques"]] as const).map(([k, l]) =>
          <button key={k} className="chip" aria-pressed={(o.range || "maison") === k} onClick={() => set({ range: k })}>{l}</button>)}</div></div></div>
      <Opt o={o} set={set} k="budgetOn" title="Budget max" desc="Par semaine, pour tout le foyer">
        <div className="row"><input className="input num-in" type="number" inputMode="decimal" min={10} step={5} value={o.budget} onChange={(e) => set({ budget: Number(e.target.value) || 0 })} /><span>€ par semaine</span></div>
      </Opt>
      <Opt o={o} set={set} k="timeOn" title="Temps max" desc="Préparation et cuisson">
        <div className="chips">{([20, 30, 45] as const).map((t) => <button key={t} className="chip" aria-pressed={o.maxTime === t} onClick={() => set({ maxTime: t })}>{t} min</button>)}</div>
      </Opt>
      <div className="opt"><span style={{ width: 26 }} /><div className="t"><b>Allergies</b><div className="d">Une case par allergène. Elles valent pour tout le repas (un seul plat, aucun risque de contamination), même si une seule personne est concernée.</div>
        <div className="chips extra">{(Object.keys(ALLERGENS) as Allergen[]).map((a) => {
          const on = o.allergens.includes(a);
          return <label key={a} className="chip" style={{ cursor: "pointer" }}><Check checked={on} onChange={() => set({ allergens: on ? o.allergens.filter((x) => x !== a) : [...o.allergens, a] })} label={ALLERGENS[a]} />{ALLERGENS[a]}</label>;
        })}</div></div></div>
      <div className="opt"><span style={{ width: 26 }} /><div className="t"><b>Ingrédients à éviter</b><div className="d">Exemple : champignons, chou, poivron</div>
        <form className="row extra" onSubmit={(e) => { e.preventDefault(); const v = avoid.trim(); if (v) { set({ avoid: [...new Set([...o.avoid, v])] }); setAvoid(""); } }}>
          <input className="input" value={avoid} onChange={(e) => setAvoid(e.target.value)} placeholder="Ajouter un ingrédient" enterKeyHint="done" />
          <button className="btn sm">Ajouter</button>
        </form>
        {!!o.avoid.length && <div className="chips extra">{o.avoid.map((w) => <button key={w} className="chip" onClick={() => set({ avoid: o.avoid.filter((x) => x !== w) })}>{w} ✕</button>)}</div>}
      </div></div>
      <Opt o={o} set={set} k="favorites" title="Privilégier mes favoris et mes plats" desc={`Ils reviennent plus souvent · ${mine} plat${mine > 1 ? "s" : ""} perso`}>
        <div className="row"><span className="grow small">Plats perso placés par semaine</span><Stepper value={s.settings.mineN} min={0} max={7} onChange={(v) => setS({ mineN: v })} /></div>
      </Opt>
      {s.app.features.ai && <Opt o={o} set={set} k="ai" title="Nouveaux plats inventés par l'IA" desc={`${Math.round(s.app.aiWeekShare * 100)} % de la semaine en plats inédits ; ils s'ajoutent à ta base`} />}
      <Opt o={o} set={set} k="useStock" title="Écouler le stock" desc="Favorise les recettes qui utilisent le stock, surtout ce qui périme bientôt" />
      <Opt o={o} set={set} k="promos" title="Profiter des promos" desc="Favorise les recettes dont les ingrédients sont en promo cette semaine dans tes magasins" />
      <Opt o={o} set={set} k="balance" title="Semaine équilibrée" desc="Du poisson, des légumineuses, pas trop de viande, et jamais deux fois le même féculent d'affilée" />
      {e.kids > 0 && <Opt o={o} set={set} k="kidFriendly" title="Plats appréciés des enfants" desc="Écarte les plats épicés ou très relevés" />}
      <Opt o={o} set={set} k="drinks" title="Boissons conseillées" desc="Un accord boisson avec chaque repas, à ajouter aux courses en un geste">
        <label className="row small"><Check checked={!!o.noAlcohol} onChange={(v) => set({ noAlcohol: v })} label="Sans alcool" />Sans alcool</label>
      </Opt>
    </Sheet>
  );
}
