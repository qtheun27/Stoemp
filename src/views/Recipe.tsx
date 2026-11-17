import { useEffect, useState } from "react";
import { ChefHat, Heart, Leaf, X, ChevronLeft, ChevronRight } from "lucide-react";
import { ingredientsOf, isVegRecipe, nameOf } from "../lib/catalog";
import { ALLERGENS } from "../lib/constants";
import { mealCostPerPerson } from "../lib/cost";
import { allergensOf } from "../lib/planner";
import { eur } from "../lib/text";
import type { Allergen, Item, Recipe } from "../lib/types";
import { fmtIngredient } from "../lib/units";
import { addManual, basePortions, cancelReception, planCtx, saveSlots, setCooked, toggleFavorite, toggleLeftovers } from "../state/actions";
import { eatersOf, headcount, slotPortions } from "../lib/household";
import { drinkFor } from "../lib/drinks";
import ReceptionSheet from "./Reception";

const COURSE = { aperitif: "Apéritif", entree: "Entrée", dessert: "Dessert" } as const;
const fmtPortions = (p: number) => `${Number.isInteger(p) ? p : p.toLocaleString("fr-BE", { maximumFractionDigits: 1 })} portion${p > 1 ? "s" : ""}`;
import { useStore } from "../state/store";
import { run, Sheet } from "../ui";

/** Substitutions locales simples proposées avec l'option « Produits de la région ». */
const LOCAL_SWAPS: Record<string, string> = {
  citron: "vinaigre de cidre belge", avocat: "fromage frais", "patate-douce": "potiron ou carottes", "lait-de-coco": "crème fraîche",
  riz: "pommes de terre", "riz-basmati": "pommes de terre", semoule: "orge perlé", "tomates-cerises": "tomates belges (en saison)",
  poivron: "courgette", aubergine: "courgette", "pave-de-saumon": "truite belge", "dos-de-cabillaud": "plie de mer du Nord",
};

export default function RecipeSheet({ recipe, slotIndex, onClose }: { recipe: Recipe; slotIndex: number | null; onClose: () => void }) {
  const s = useStore();
  const [cook, setCook] = useState(false);
  const [other, setOther] = useState<Recipe | null>(null);
  const slot = slotIndex != null ? s.week?.slots[slotIndex] : undefined;
  const veg = slot ? slot.veg : s.settings.options.veg && !isVegRecipe(recipe);
  const base = basePortions(s);
  const persons = slot ? Math.max(slotPortions(slot, base), base) : base;
  const [reception, setReception] = useState(false);
  const drink = drinkFor(recipe, veg, s.idx, !!s.settings.options.noAlcohol);
  const ings = ingredientsOf(recipe, veg).map((i) => ({ ing: i, item: s.idx.get(i.itemId) })).filter((x): x is { ing: typeof x.ing; item: Item } => !!x.item);
  const al = allergensOf(recipe, veg, s.idx) as Allergen[];
  const cost = mealCostPerPerson(recipe, veg, planCtx(s).cost);
  const fav = s.prefs.favorites.includes(recipe.id);
  const noBio = s.settings.options.organic ? ings.filter((x) => !x.item.organicAvailable && !x.item.staple) : [];
  const swaps = s.settings.options.local ? ings.filter((x) => !x.item.local && LOCAL_SWAPS[x.item.id]) : [];
  const mine = [...s.recipes.values()].filter((r) => r.source === "perso" && !r.deleted && r.id !== recipe.id);

  const toggleVeg = () => { if (slotIndex == null || !s.week) return; const sl = [...s.week.slots]; sl[slotIndex] = { ...sl[slotIndex], veg: !veg }; run(() => saveSlots(s, sl)); };
  const putMine = (id: string) => { if (slotIndex == null || !s.week) return; const sl = [...s.week.slots]; sl[slotIndex] = { ...sl[slotIndex], recipeId: id, veg: false, cooked: false }; run(() => saveSlots(s, sl), "Repas remplacé"); onClose(); };

  if (cook) return <CookMode recipe={recipe} veg={veg} onClose={() => setCook(false)} />;
  if (other) return <RecipeSheet recipe={other} slotIndex={null} onClose={() => setOther(null)} />;
  if (reception && slotIndex != null) return <ReceptionSheet slotIndex={slotIndex} onClose={() => setReception(false)} onDone={onClose} />;
  return (
    <Sheet title={nameOf(recipe, veg)} onClose={onClose}
      sub={<>⏱ {recipe.prepMin} min · {fmtPortions(persons)}{slot?.leftovers ? " (dont demain midi)" : ""} · {eur(cost)} / portion{recipe.source === "ia" ? " · ✨ IA" : recipe.source === "perso" ? " · 📝 mon plat" : ""}</>}>
      {!!al.length && <div className="chips" style={{ margin: "4px 0 10px" }}>{al.map((a) => <span key={a} className="tag warn">Contient : {ALLERGENS[a]}</span>)}</div>}
      <div className="row wrap" style={{ margin: "6px 0 14px" }}>
        {slot && !isVegRecipe(recipe) && <button className="btn ghost sm" onClick={toggleVeg}><Leaf size={16} />{veg ? "Version classique" : "Version végé"}</button>}
        <button className="btn ghost sm" onClick={() => run(() => toggleFavorite(s.hid!, s.prefs, recipe.id))}><Heart size={16} fill={fav ? "currentColor" : "none"} />{fav ? "Favori" : "Ajouter aux favoris"}</button>
        {slot && <button className="btn ghost sm" onClick={() => run(() => setCooked(s, slotIndex!, !slot.cooked), slot.cooked ? "Annulé : stock rétabli" : "Bon appétit ! Stock mis à jour")}><ChefHat size={16} />{slot.cooked ? "Pas encore cuisiné" : "Cuisiné"}</button>}
        <button className="btn sm" onClick={() => setCook(true)}><ChefHat size={16} />Mode cuisine</button>
      </div>
      {slot && <div className="row wrap" style={{ margin: "-6px 0 12px" }}>
        {slot.meal === "soir" && !slot.fromLeftovers && <button className="btn ghost sm" aria-pressed={!!slot.leftovers} onClick={() => run(() => toggleLeftovers(s, slotIndex!, !slot.leftovers), slot.leftovers ? "Restes annulés" : "Portion doublée : demain midi = restes 🍱")}>🍱 {slot.leftovers ? "Annuler les restes de demain" : "Cuisiner aussi pour demain midi"}</button>}
        {!slot.fromLeftovers && !slot.guests && s.app.features.ai && <button className="btn ghost sm" onClick={() => setReception(true)}>🎉 Je reçois</button>}
      </div>}
      {slot?.guests && <div className="card" style={{ margin: "0 0 12px", background: "var(--bg)" }}>
        <h3>🎉 Réception · {headcount(eatersOf(s.settings)) + slot.guests.adults + slot.guests.kids} personnes</h3>
        {(slot.courses || []).map((c) => { const r = s.recipes.get(c.recipeId); return r ? <p key={c.recipeId} style={{ margin: "2px 0" }}><b>{COURSE[c.type]}</b> : {r.name} <span className="muted small">⏱ {r.prepMin} min</span></p> : null; })}
        <p style={{ margin: "2px 0" }}><b>Plat</b> : {recipe.name}</p>
        {!!slot.drinks?.length && <p className="small" style={{ margin: "6px 0 0" }}>🍷 {slot.drinks.join(" · ")}</p>}
        <p className="small muted">Les ingrédients de tous les services sont dans la liste de courses. Touche un service dans la semaine pour voir sa recette.</p>
        <div className="row wrap">
          {(slot.courses || []).map((c) => { const r = s.recipes.get(c.recipeId); return r ? <button key={c.recipeId} className="chip" onClick={() => setOther(r)}>{COURSE[c.type]} : recette</button> : null; })}
          <button className="btn soft sm" onClick={() => run(() => cancelReception(s, slotIndex!), "Réception annulée")}>Annuler la réception</button>
        </div>
      </div>}
      {s.settings.options.drinks !== false && !slot?.guests && <p className="small" style={{ margin: "0 0 12px" }}>🍷 <b>Avec ce plat</b> : {drink.adult}{eatersOf(s.settings).kids + eatersOf(s.settings).teens > 0 ? ` · pour les enfants : ${drink.kid}` : ""}
        {" "}<button className="btn soft sm" onClick={() => run(async () => { const it = s.idx.get(drink.adultItem); if (it) await addManual(s, it.name); }, "Boisson ajoutée aux courses")}>+ courses</button></p>}
      {slot && !!mine.length && <>
        <h3 style={{ margin: "8px 0 6px" }}>Mettre un de mes plats à la place</h3>
        <div className="scroll-x">{mine.map((r) => <button key={r.id} className="chip" onClick={() => putMine(r.id)}>📝 {r.name}</button>)}</div>
      </>}
      <h3 style={{ margin: "16px 0 6px" }}>Ingrédients</h3>
      <ul className="ings">
        {ings.map(({ ing, item }) => {
          const st = s.stock.get(item.id);
          return <li key={item.id}><span>{item.name}{st && st.qty > 0 && <span className="tag ac" style={{ marginLeft: 6 }}>en stock</span>}</span><span className="muted num">{fmtIngredient(ing, item, persons)}</span></li>;
        })}
      </ul>
      {!!noBio.length && <p className="small muted">🌿 Sans version bio connue : {noBio.map((x) => x.item.name).join(", ")}.</p>}
      {!!swaps.length && <p className="small muted">📍 Version locale : {swaps.map((x) => `${x.item.name} → ${LOCAL_SWAPS[x.item.id]}`).join(" ; ")}.</p>}
      <p className="small muted">Sel, poivre et huile non listés.</p>
      <h3 style={{ margin: "16px 0 6px" }}>Préparation</h3>
      <ol>{recipe.steps.map((st, i) => <li key={i}>{st}</li>)}</ol>
    </Sheet>
  );
}

/** Mode cuisine : étapes en grand et écran qui reste allumé. */
function CookMode({ recipe, veg, onClose }: { recipe: Recipe; veg: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock?.request("screen").then((l) => { lock = l; }).catch(() => {});
    return () => { lock?.release().catch(() => {}); };
  }, []);
  const n = recipe.steps.length;
  return (
    <div className="cook" role="dialog" aria-modal="true">
      <div className="row between"><b>{nameOf(recipe, veg)}</b><button className="ib" onClick={onClose} aria-label="Quitter"><X size={20} /></button></div>
      <div className="progress" style={{ marginTop: 12 }}><i style={{ width: `${((i + 1) / n) * 100}%` }} /></div>
      <div className="muted" style={{ marginTop: 10 }}>Étape {i + 1} sur {n}</div>
      <div className="step">{recipe.steps[i]}</div>
      <div className="row">
        <button className="btn ghost grow" disabled={i === 0} onClick={() => setI(i - 1)}><ChevronLeft size={18} />Précédente</button>
        {i < n - 1 ? <button className="btn grow" onClick={() => setI(i + 1)}>Suivante<ChevronRight size={18} /></button> : <button className="btn grow" onClick={onClose}>Terminé</button>}
      </div>
    </div>
  );
}
