import { useState } from "react";
import { Heart, Sparkles, Trash2 } from "lucide-react";
import { isVegRecipe } from "../lib/catalog";
import type { Recipe } from "../lib/types";
import { deleteRecipe, saveManualDish, structureMyDish, toggleFavorite } from "../state/actions";
import { useStore } from "../state/store";
import { Empty, run, toast, TopBar } from "../ui";
import RecipeSheet from "./Recipe";

export default function Dishes() {
  const s = useStore();
  const [f, setF] = useState({ name: "", persons: s.settings.persons, minutes: 30, ingredients: "", steps: "" });
  const [busy, setBusy] = useState<"ai" | "save" | null>(null);
  const [open, setOpen] = useState<Recipe | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const all = [...s.recipes.values()].filter((r) => !r.deleted);
  const mine = all.filter((r) => r.source === "perso");
  const ia = all.filter((r) => r.source === "ia");
  const favs = all.filter((r) => s.prefs.favorites.includes(r.id));
  const reset = () => setF({ ...f, name: "", ingredients: "", steps: "" });

  const withAi = async () => {
    if (!f.name.trim()) return toast("Indique le nom du plat");
    if (!s.online) return toast("Il faut une connexion pour l'IA : enregistre tel quel");
    setBusy("ai");
    const r = await run(() => structureMyDish({ householdId: s.hid!, ...f, name: f.name.trim() }), "Plat enregistré ✨");
    setBusy(null);
    if (r) reset();
  };
  const asIs = async () => {
    if (!f.name.trim()) return toast("Indique le nom du plat");
    setBusy("save");
    const unknown = await run(() => saveManualDish(s, { ...f, name: f.name.trim() }));
    setBusy(null);
    if (unknown) { toast(unknown.length ? `Enregistré. Non reconnus : ${unknown.join(", ")}` : "Plat enregistré"); reset(); }
  };
  const del = (r: Recipe) => {
    if (armed !== r.id) { setArmed(r.id); toast("Touche encore 🗑 pour confirmer"); return; }
    setArmed(null); run(() => deleteRecipe(r.id), "Plat supprimé");
  };
  const Row = ({ r }: { r: Recipe }) => <div className="li">
    <button className="main-t" onClick={() => setOpen(r)}><span className="name">{r.name}</span>
      <span className="meta"><span>⏱ {r.prepMin} min</span>{isVegRecipe(r) && <span>🌱 végé</span>}<span>{r.ingredients.length + r.meat.length} ingrédients</span></span></button>
    <button className="ib" aria-pressed={s.prefs.favorites.includes(r.id)} aria-label="Favori" onClick={() => run(() => toggleFavorite(s.hid!, s.prefs, r.id))}><Heart size={18} fill={s.prefs.favorites.includes(r.id) ? "currentColor" : "none"} /></button>
    {r.source !== "base" && <button className="ib" aria-label="Supprimer" onClick={() => del(r)}>{armed === r.id ? "✔︎" : <Trash2 size={18} />}</button>}
  </div>;

  return (
    <>
      <TopBar title="Mes plats" sub={`${mine.length} plats perso · ${s.settings.mineN} placés par semaine`} />
      <div className="content wide">
        <div className="cols">
          <div>
            <div className="card">
              <h3>Ajouter un de mes plats</h3>
              <p>Le nom suffit : l'IA complète ingrédients, version végé et étapes. Tu peux aussi tout écrire toi-même.</p>
              <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nom du plat (ex. pâtes au saumon de maman)" />
              <div className="row" style={{ marginTop: 8 }}>
                <label className="row small">Pour <input className="input num-in" type="number" min={1} max={12} value={f.persons} onChange={(e) => setF({ ...f, persons: Math.max(1, +e.target.value || 1) })} /> pers.</label>
                <label className="row small">⏱ <input className="input num-in" type="number" min={5} step={5} value={f.minutes} onChange={(e) => setF({ ...f, minutes: Math.max(5, +e.target.value || 30) })} /> min</label>
              </div>
              <textarea className="input" rows={5} style={{ marginTop: 8 }} value={f.ingredients} onChange={(e) => setF({ ...f, ingredients: e.target.value })} placeholder={"Ingrédients, un par ligne (facultatif avec l'IA)\n400 g de pâtes\n2 pavés de saumon\n20 cl de crème"} />
              <textarea className="input" rows={3} style={{ marginTop: 8 }} value={f.steps} onChange={(e) => setF({ ...f, steps: e.target.value })} placeholder="Étapes, une par ligne (facultatif)" />
              <div className="row wrap" style={{ marginTop: 10 }}>
                <button className="btn" disabled={!!busy} onClick={withAi}><Sparkles size={18} />{busy === "ai" ? "L'IA rédige…" : "Compléter avec l'IA"}</button>
                <button className="btn ghost" disabled={!!busy} onClick={asIs}>Enregistrer tel quel</button>
              </div>
            </div>
            <div className="section-title"><h2>Mes plats</h2><span className="muted small">touche un plat de la semaine pour le remplacer par l'un d'eux</span></div>
            {mine.length ? <div className="list">{mine.map((r) => <Row key={r.id} r={r} />)}</div> : <Empty icon="📝">Aucun plat perso pour l'instant.</Empty>}
            {!!ia.length && <><div className="section-title"><h2>Inventés par l'IA</h2><span className="muted small">{ia.length}</span></div><div className="list">{ia.map((r) => <Row key={r.id} r={r} />)}</div></>}
          </div>
          <div className="side">
            <div className="section-title" style={{ marginTop: 0 }}><h2>Favoris</h2></div>
            {favs.length ? <div className="list">{favs.map((r) => <Row key={r.id} r={r} />)}</div> : <p className="muted small">Touche ♡ sur un repas pour l'ajouter ici.</p>}
            <div className="section-title"><h2>Toutes les recettes</h2><span className="muted small">{all.length}</span></div>
            <div className="list">{all.filter((r) => r.source === "base").map((r) => <Row key={r.id} r={r} />)}</div>
          </div>
        </div>
      </div>
      {open && <RecipeSheet recipe={open} slotIndex={null} onClose={() => setOpen(null)} />}
    </>
  );
}
