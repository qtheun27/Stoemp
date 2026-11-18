import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { mains, ingredientsOf } from "../lib/catalog";
import { ALLERGENS, CUISINES, CUISINE_ORDER } from "../lib/constants";
import { newPerson, tastingDeck, TASTE_GROUPS, type Person, type Rating } from "../lib/tastes";
import type { Allergen, Recipe } from "../lib/types";
import { rateRecipe, savePeople } from "../state/actions";
import { useStore } from "../state/store";
import { run, Sheet, toast } from "../ui";
import { DishArt } from "./DishArt";

const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
const GROUP_KEYS = Object.keys(TASTE_GROUPS);
const RATINGS: { v: Rating; icon: string; label: string }[] = [
  { v: 1, icon: "😍", label: "J'adore" }, { v: 0, icon: "🙂", label: "Bof / pourquoi pas" }, { v: -1, icon: "🙅", label: "Non merci" },
];

/** Carte « Les goûts du foyer » (Réglages) : un profil par membre, et le jeu pour affiner. */
export function TastesCard() {
  const s = useStore();
  const people = s.tastes.people;
  const [edit, setEdit] = useState<Person | null>(null);
  const [game, setGame] = useState(false);
  const rated = (p: Person) => Object.keys(s.tastes.ratings[p.id] || {}).length;
  return <div className="card">
    <h3>👨‍👩‍👧 Les goûts du foyer</h3>
    <p className="small muted">Une fiche par personne (même les enfants) : la semaine proposée plaira à toute la table. Rien n'est obligatoire.</p>
    {people.map((p) => <div key={p.id} className="row between" style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
      <span className="grow"><b>{p.name}</b> <span className="small muted">· {p.age}{p.diet !== "tout" ? ` · ${p.diet === "vege" ? "végétarien" : p.diet === "pesco" ? "pescétarien" : "sans porc"}` : ""} · {rated(p)} plat(s) noté(s)</span></span>
      <button className="ib" aria-label={`Modifier ${p.name}`} onClick={() => setEdit(p)}><Pencil size={18} /></button>
    </div>)}
    <div className="row wrap" style={{ marginTop: 10 }}>
      <button className="btn ghost" onClick={() => setEdit(newPerson(""))}><Plus size={18} />Ajouter un membre</button>
      {people.length > 0 && <button className="btn" onClick={() => setGame(true)}>🎲 Ça te tente ?</button>}
    </div>
    {edit && <PersonSheet person={edit} onClose={() => setEdit(null)} />}
    {game && <TastingSheet onClose={() => setGame(false)} />}
  </div>;
}

/** Les questions d'un profil, en boutons (pas de texte à taper, sauf le prénom). */
function PersonSheet({ person, onClose }: { person: Person; onClose: () => void }) {
  const s = useStore();
  const [p, setP] = useState<Person>(person);
  const set = (patch: Partial<Person>) => setP({ ...p, ...patch });
  const exists = s.tastes.people.some((x) => x.id === p.id);
  const save = () => {
    if (!p.name.trim()) return toast("Indique un prénom");
    const people = exists ? s.tastes.people.map((x) => (x.id === p.id ? p : x)) : [...s.tastes.people, p];
    run(() => savePeople(s, people).then(onClose), "Profil enregistré");
  };
  const remove = () => { if (confirm(`Retirer ${p.name} du foyer ?`)) run(() => savePeople(s, s.tastes.people.filter((x) => x.id !== p.id)).then(onClose), "Profil retiré"); };
  const chip = (on: boolean, label: string, onClick: () => void, key?: string) =>
    <button key={key ?? label} className="chip" aria-pressed={on} onClick={onClick}>{label}</button>;
  const Q = ({ t, children }: { t: string; children: React.ReactNode }) => <div style={{ margin: "12px 0" }}><div className="small muted" style={{ marginBottom: 6 }}>{t}</div><div className="chips">{children}</div></div>;
  return <Sheet title={exists ? p.name || "Profil" : "Nouveau membre"} sub="Quelques questions pour mieux le connaître" onClose={onClose}
    actions={<>{exists && <button className="btn ghost" onClick={remove}><Trash2 size={18} />Retirer</button>}<button className="btn" onClick={save}>Enregistrer</button></>}>
    <label className="field">Prénom</label>
    <input className="input" value={p.name} maxLength={30} placeholder="ex. Léa" onChange={(e) => set({ name: e.target.value })} />
    <Q t="Âge">{(["enfant", "ado", "adulte"] as const).map((a) => chip(p.age === a, a === "enfant" ? "Enfant (3-10 ans)" : a === "ado" ? "Ado (11-17 ans)" : "Adulte", () => set({ age: a }), a))}</Q>
    <Q t="Ce qu'il ou elle mange">{([["tout", "De tout"], ["sans-porc", "Sans porc"], ["pesco", "Pescétarien (poisson oui)"], ["vege", "Végétarien"]] as const).map(([k, l]) => chip(p.diet === k, l, () => set({ diet: k }), k))}</Q>
    <Q t="Allergies ou intolérances (pour tout le repas)">{(Object.keys(ALLERGENS) as Allergen[]).map((a) => chip(p.allergens.includes(a), ALLERGENS[a], () => set({ allergens: toggle(p.allergens, a) }), a))}</Q>
    <Q t="🙅 Jamais dans mon assiette">{GROUP_KEYS.map((k) => chip(p.never.includes(k), `${TASTE_GROUPS[k].icon} ${TASTE_GROUPS[k].label}`, () => set({ never: toggle(p.never, k), loves: p.loves.filter((x) => x !== k) }), k))}</Q>
    <Q t="😍 J'adore">{GROUP_KEYS.map((k) => chip(p.loves.includes(k), `${TASTE_GROUPS[k].icon} ${TASTE_GROUPS[k].label}`, () => set({ loves: toggle(p.loves, k), never: p.never.filter((x) => x !== k) }), k))}</Q>
    <Q t="Cuisines préférées">{CUISINE_ORDER.map((c) => chip(p.cuisines.includes(c), `${CUISINES[c].icon} ${CUISINES[c].label}`, () => set({ cuisines: toggle(p.cuisines, c) }), c))}</Q>
    <Q t="Le piquant">{([0, 1, 2, 3] as const).map((n) => chip(p.spice === n, n === 0 ? "Pas du tout" : "🌶️".repeat(n), () => set({ spice: n }), String(n)))}</Q>
    <Q t="À table, plutôt…">{([[0, "Les classiques rassurants"], [1, "Un peu de découverte"], [2, "J'adore découvrir"]] as const).map(([n, l]) => chip(p.curious === n, l, () => set({ curious: n }), String(n)))}</Q>
    {p.age === "adulte" && <Q t="En semaine, je cuisine…">{([[0, "Je ne cuisine pas"], [20, "20 min max"], [40, "40 min"], [90, "J'ai le temps"]] as const).map(([n, l]) =>
      chip((p.cookMin ?? 40) === n, l, () => set({ cookMin: n }), String(n)))}</Q>}
  </Sheet>;
}

/** Points clés d'un plat pour se décider sans photo : cuisine, durée, ingrédients principaux. */
function DishCard({ r }: { r: Recipe }) {
  const s = useStore();
  const main = ingredientsOf(r, false).map((i) => s.idx.get(i.itemId)).filter((it) => it && !it.staple && it.category !== "ep").slice(0, 5).map((it) => it!.name);
  return <div className="card" style={{ textAlign: "center", padding: "12px 12px 16px" }}>
    <DishArt recipe={r} idx={s.idx} height={170} />
    <h3 style={{ margin: "10px 0 4px" }}>{r.name}</h3>
    <p className="small muted">{r.cuisine ? CUISINES[r.cuisine].label : ""} · {r.prepMin} min</p>
    <p className="small">{main.join(" · ")}</p>
  </div>;
}

/** Jeu « Ça te tente ? » : chaque membre note des plats variés en un geste ; le planificateur en tient compte. */
export function TastingSheet({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [pid, setPid] = useState(s.tastes.people[0]?.id);
  const person = s.tastes.people.find((p) => p.id === pid);
  const deck = useMemo(() => (person ? tastingDeck(mains(s.recipes.values()).filter((r) => !r.deleted), person, s.tastes) : []), [pid]); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const r = deck[i];
  const vote = (v: Rating) => { if (!person || !r) return; rateRecipe(s, person.id, r.id, v).catch(() => toast("Avis non enregistré (hors ligne ?)")); setI(i + 1); };
  return <Sheet title="🎲 Ça te tente ?" sub="Un geste par plat : l'appli apprend ce que chacun aime" onClose={onClose}>
    <div className="chips" style={{ marginBottom: 10 }}>{s.tastes.people.map((p) =>
      <button key={p.id} className="chip" aria-pressed={p.id === pid} onClick={() => { setPid(p.id); setI(0); }}>{p.name}</button>)}</div>
    {!person ? <p>Ajoute d'abord un membre du foyer.</p> : !r ? <p>🎉 Merci {person.name} ! {deck.length ? `${deck.length} plats notés.` : "Tous les plats sont déjà notés."} Rejoue quand tu veux.</p> : <>
      <p className="small muted">{person.name} · plat {i + 1} / {deck.length}</p>
      <DishCard r={r} />
      <div className="row" style={{ gap: 8, marginTop: 12 }}>{RATINGS.map((x) =>
        <button key={x.v} className="btn ghost grow" style={{ flexDirection: "column", minHeight: 64 }} aria-label={x.label} onClick={() => vote(x.v)}>
          <span style={{ fontSize: 26 }}>{x.icon}</span><span className="small">{x.label}</span></button>)}</div>
      <button className="btn ghost" style={{ marginTop: 8, width: "100%" }} onClick={() => setI(i + 1)}>Je ne sais pas, plat suivant</button>
    </>}
  </Sheet>;
}

/** « Le plat d'hier ? » : un geste par membre, le lendemain du repas (écran Semaine). */
export function YesterdayRating({ recipeIds }: { recipeIds: string[] }) {
  const s = useStore();
  const [hidden, setHidden] = useState<string[]>([]);
  const people = s.tastes.people;
  if (!people.length) return null;
  const todo = recipeIds.filter((id, k) => recipeIds.indexOf(id) === k && !hidden.includes(id) && s.recipes.get(id)
    && people.some((p) => s.tastes.ratings[p.id]?.[id] === undefined));
  if (!todo.length) return null;
  const id = todo[0], r = s.recipes.get(id)!;
  return <div className="card" style={{ marginBottom: 12 }}>
    <div className="row between"><b>Le plat d'hier : {r.name}</b>
      <button className="ib plain" aria-label="Plus tard" onClick={() => setHidden([...hidden, id])}>✕</button></div>
    {people.map((p) => { const cur = s.tastes.ratings[p.id]?.[id];
      return <div key={p.id} className="row between" style={{ marginTop: 6 }}>
        <span className="grow small">{p.name}</span>
        <span className="row" style={{ gap: 4 }}>{RATINGS.map((x) => <button key={x.v} className="chip" aria-pressed={cur === x.v} aria-label={`${p.name} : ${x.label}`}
          onClick={() => rateRecipe(s, p.id, id, x.v).catch(() => toast("Avis non enregistré (hors ligne ?)"))}>{x.icon}</button>)}</span>
      </div>; })}
  </div>;
}
