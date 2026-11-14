import { useState } from "react";
import { ALLERGENS, SEASONS, SEASON_ORDER } from "../lib/constants";
import type { Allergen, GenOptions, Settings } from "../lib/types";
import { saveSettings } from "../state/actions";
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
  const mine = [...s.recipes.values()].filter((r) => r.source === "perso" && !r.deleted).length;
  return (
    <Sheet title="Options" sub="Elles s'appliquent à la prochaine génération" onClose={onClose}>
      <div className="row wrap" style={{ gap: 14, margin: "6px 0 10px" }}>
        <div><div className="small muted">Personnes</div><Stepper value={s.settings.persons} onChange={(v) => setS({ persons: v })} fmt={(v) => `${v} pers.`} /></div>
        <div><div className="small muted">Repas</div>
          <div className="chips">
            <button className="chip" aria-pressed={s.settings.mealsPerDay === 1} onClick={() => setS({ mealsPerDay: 1 })}>7 · soir</button>
            <button className="chip" aria-pressed={s.settings.mealsPerDay === 2} onClick={() => setS({ mealsPerDay: 2 })}>14 · midi + soir</button>
          </div></div>
      </div>
      <Opt o={o} set={set} k="seasonal" title="De saison" desc="Mois courant, ou saison choisie">
        <div className="chips">
          <button className="chip" aria-pressed={o.season === "auto"} onClick={() => set({ season: "auto" })}>Mois courant</button>
          {SEASON_ORDER.map((k) => <button key={k} className="chip" aria-pressed={o.season === k} onClick={() => set({ season: k })}>{SEASONS[k].icon} {SEASONS[k].label}</button>)}
        </div>
      </Opt>
      <Opt o={o} set={set} k="local" title="Produits de la région" desc="Ingrédients principaux produits en Belgique, substitutions locales proposées" />
      <Opt o={o} set={set} k="organic" title="Bio" desc="Prix bio quand ils existent ; les articles sans version bio sont signalés" />
      <Opt o={o} set={set} k="veg" title="Végétarien" desc="Tous les repas en version végé (chaque repas garde son bouton 🌱)" />
      <Opt o={o} set={set} k="budgetOn" title="Budget max" desc="Par semaine, pour tout le foyer">
        <div className="row"><input className="input num-in" type="number" inputMode="decimal" min={10} step={5} value={o.budget} onChange={(e) => set({ budget: Number(e.target.value) || 0 })} /><span>€ par semaine</span></div>
      </Opt>
      <Opt o={o} set={set} k="timeOn" title="Temps max" desc="Préparation et cuisson">
        <div className="chips">{([20, 30, 45] as const).map((t) => <button key={t} className="chip" aria-pressed={o.maxTime === t} onClick={() => set({ maxTime: t })}>{t} min</button>)}</div>
      </Opt>
      <div className="opt"><span style={{ width: 26 }} /><div className="t"><b>Allergies</b><div className="d">Une case par allergène</div>
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
      <Opt o={o} set={set} k="ai" title="Nouveaux plats inventés par l'IA" desc="La moitié de la semaine en plats inédits ; ils s'ajoutent à ta base" />
      <Opt o={o} set={set} k="useStock" title="Écouler le stock" desc="Favorise les recettes qui utilisent le stock, surtout ce qui périme bientôt" />
    </Sheet>
  );
}
