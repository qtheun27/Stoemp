import { useState } from "react";
import { Heart, Sparkles, Trash2 } from "lucide-react";
import { cookable, isVegRecipe } from "../lib/catalog";
import { CUISINES, CUISINE_ORDER } from "../lib/constants";
import { norm } from "../lib/text";
import type { Cuisine, Recipe } from "../lib/types";
import { deleteRecipe, saveManualDish, structureMyDish, toggleFavorite } from "../state/actions";
import { useStore } from "../state/store";
import { Check, Empty, run, toast, TopBar } from "../ui";
import RecipeSheet from "./Recipe";

export default function Dishes() {
  const s = useStore();
  const [f, setF] = useState({ name: "", persons: s.settings.persons, minutes: 30, ingredients: "", steps: "" });
  const [busy, setBusy] = useState<"ai" | "save" | null>(null);
  const [open, setOpen] = useState<Recipe | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [tab, setTab] = useState<"lib" | "mine" | "favs">("lib");
  const [q, setQ] = useState("");
  const [cu, setCu] = useState<Cuisine | "all">("all");
  const [vegOnly, setVegOnly] = useState(false);
  const all = cookable(s.recipes.values()).filter((r) => !r.deleted);
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
      <span className="meta">{r.cuisine && <span>{CUISINES[r.cuisine].icon} {CUISINES[r.cuisine].label}</span>}<span>⏱ {r.prepMin} min</span>{isVegRecipe(r) && <span>🌱 végé</span>}</span></button>
    <button className="ib" aria-pressed={s.prefs.favorites.includes(r.id)} aria-label="Favori" onClick={() => run(() => toggleFavorite(s.hid!, s.prefs, r.id))}><Heart size={18} fill={s.prefs.favorites.includes(r.id) ? "currentColor" : "none"} /></button>
    {r.source !== "base" && <button className="ib" aria-label="Supprimer" onClick={() => del(r)}>{armed === r.id ? "✔︎" : <Trash2 size={18} />}</button>}
  </div>;
  // Bibliothèque : toutes les recettes à cuisiner, filtrées par cuisine et par recherche.
  const lib = all.filter((r) => (cu === "all" || r.cuisine === cu) && (!q || norm(r.name + " " + (r.vegName || "")).includes(norm(q))) && (!vegOnly || isVegRecipe(r) || !!r.vegName))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const count = (c: Cuisine) => all.filter((r) => r.cuisine === c).length;

  return (
    <>
      <TopBar title="Plats" sub={`${all.length} recettes · ${mine.length} plats perso`} />
      <div className="content wide">
        <div className="seg" style={{ margin: "4px 0 12px" }}>
          <button aria-pressed={tab === "lib"} onClick={() => setTab("lib")}>Bibliothèque</button>
          <button aria-pressed={tab === "mine"} onClick={() => setTab("mine")}>Mes plats</button>
          <button aria-pressed={tab === "favs"} onClick={() => setTab("favs")}>Favoris{favs.length ? ` (${favs.length})` : ""}</button>
        </div>

        {tab === "lib" && <>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un plat (lasagne, curry, moules…)" aria-label="Chercher une recette" />
          <div className="scroll-x" style={{ margin: "10px -16px 6px" }}>
            <button className="chip" aria-pressed={cu === "all"} onClick={() => setCu("all")}>Toutes · {all.length}</button>
            {CUISINE_ORDER.filter(count).map((c) => <button key={c} className="chip" aria-pressed={cu === c} onClick={() => setCu(c)}>{CUISINES[c].icon} {CUISINES[c].label} · {count(c)}</button>)}
          </div>
          <label className="row small" style={{ margin: "4px 2px 10px" }}><Check checked={vegOnly} onChange={setVegOnly} label="Avec une version végé" />Avec une version végé</label>
          {lib.length ? <div className="list">{lib.map((r) => <Row key={r.id} r={r} />)}</div> : <Empty icon="🔎">Aucune recette ne correspond.</Empty>}
          <p className="small muted">Touche une recette pour la voir et la placer dans ta semaine.</p>
        </>}

        {tab === "mine" && <>
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
              {s.app.features.ai && <button className="btn" disabled={!!busy} onClick={withAi}><Sparkles size={18} />{busy === "ai" ? "L'IA rédige…" : "Compléter avec l'IA"}</button>}
              <button className="btn ghost" disabled={!!busy} onClick={asIs}>Enregistrer tel quel</button>
            </div>
          </div>
          <div className="section-title"><h2>Mes plats</h2><span className="muted small">{mine.length}</span></div>
          {mine.length ? <div className="list">{mine.map((r) => <Row key={r.id} r={r} />)}</div> : <Empty icon="📝">Aucun plat perso pour l'instant.</Empty>}
          {!!ia.length && <><div className="section-title"><h2>Inventés par l'IA</h2><span className="muted small">{ia.length}</span></div><div className="list">{ia.map((r) => <Row key={r.id} r={r} />)}</div></>}
        </>}

        {tab === "favs" && (favs.length ? <div className="list">{favs.map((r) => <Row key={r.id} r={r} />)}</div> : <Empty icon="♡">Touche ♡ sur un repas ou une recette pour l'ajouter ici.</Empty>)}
      </div>
      {open && <RecipeSheet recipe={open} slotIndex={null} onClose={() => setOpen(null)} />}
    </>
  );
}
