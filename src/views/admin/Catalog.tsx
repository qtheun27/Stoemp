import { useDeferredValue, useMemo, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { Plus } from "lucide-react";
import { db } from "../../firebase";
import { BASE_RECIPES } from "../../lib/catalog";
import { ALLERGENS, CAT_ORDER, CATS } from "../../lib/constants";
import { eur, norm, slug } from "../../lib/text";
import type { Allergen, Cat, Item, Unit } from "../../lib/types";
import { fmtQty } from "../../lib/units";
import { useStore } from "../../state/store";
import { Check, run, Sheet, Switch, toast } from "../../ui";
import { findDuplicates } from "../../lib/similar";
import { adminDeleteItem, adminMergeItems } from "./api";

const EMPTY: Item = { id: "", name: "", aliases: [], category: "ep", unit: "pc", local: false, organicAvailable: false, seasonMonths: [], perishable: false, shelfLifeDays: 365, staple: false, common: false, allergens: [], packSize: 1, demoPrice: 1, source: "base" };

export default function Catalog() {
  const s = useStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Cat | "all" | "pret">("all");
  const [edit, setEdit] = useState<Item | null>(null);
  const [view, setView] = useState<"items" | "recipes" | "dups">("items");
  // Liste triée et texte de recherche préparés une seule fois (pas à chaque frappe).
  const sorted = useMemo(() => s.idx.all().map((i) => ({ i, key: norm([i.name, ...i.aliases].join(" ")) })).sort((a, b) => a.i.name.localeCompare(b.i.name, "fr")), [s.idx]);
  const dq = useDeferredValue(q);
  const items = useMemo(() => { const nq = norm(dq);
    return sorted.filter(({ i, key }) => (cat === "all" || (cat === "pret" ? !!i.ready : i.category === cat)) && (!nq || key.includes(nq))).map((x) => x.i); }, [sorted, cat, dq]);
  return <div className="stack">
    <div className="row wrap">
      <div className="seg"><button aria-pressed={view === "items"} onClick={() => setView("items")}>Articles ({sorted.length})</button><button aria-pressed={view === "dups"} onClick={() => setView("dups")}>Doublons probables</button><button aria-pressed={view === "recipes"} onClick={() => setView("recipes")}>Recettes de base</button></div>
      {view === "items" && <button className="btn sm" onClick={() => setEdit({ ...EMPTY })}><Plus size={16} />Nouvel article</button>}
    </div>
    {view === "items" ? <>
      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un article ou un alias" />
      <div className="scroll-x"><button className="chip" aria-pressed={cat === "all"} onClick={() => setCat("all")}>Tous</button><button className="chip" aria-pressed={cat === "pret"} onClick={() => setCat("pret")}>🥡 Plats préparés</button>{CAT_ORDER.map((c) => <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{CATS[c].icon} {CATS[c].label}</button>)}</div>
      <div className="list">{items.slice(0, 300).map((i) => <button key={i.id} className="li" style={{ width: "100%", border: 0, background: "none", textAlign: "left" }} onClick={() => setEdit(i)}>
        <span className="main-t"><span className="name">{CATS[i.category].icon} {i.name} {i.ready && <span className="tag">🥡 plat préparé</span>} {i.source === "ia" && <span className="tag ac">ajouté par l'IA</span>}</span>
          <span className="meta"><span>{fmtQty(i.packSize, i.unit)}</span><span>{eur(i.demoPrice)}</span>{i.local && <span>🇧🇪</span>}{i.organicAvailable && <span>bio</span>}{i.staple && <span>fond de placard</span>}{i.common && <span>courant</span>}{!!i.aliases.length && <span className="small">{i.aliases.slice(0, 3).join(", ")}</span>}</span></span>
      </button>)}</div>
    </> : view === "dups" ? <Duplicates /> : <RecipesAdmin />}
    {edit && <ItemSheet item={edit} onClose={() => setEdit(null)} />}
  </div>;
}

function ItemSheet({ item, onClose }: { item: Item; onClose: () => void }) {
  const [f, setF] = useState<Item>(item);
  const [aliases, setAliases] = useState(item.aliases.join(", "));
  const isNew = !item.id;
  const save = async () => {
    if (!f.name.trim()) return;
    const id = isNew ? slug(f.name) : item.id;
    const data = { ...f, id, name: f.name.trim(), aliases: aliases.split(",").map((a) => a.trim()).filter(Boolean), source: item.source || "base" };
    await run(() => setDoc(doc(db, "items", id), JSON.parse(JSON.stringify(data))), "Article enregistré pour tous les foyers");
    onClose();
  };
  const flag = (k: "local" | "organicAvailable" | "perishable" | "staple" | "common" | "ready", l: string) =>
    <div className="row between" style={{ padding: "6px 0" }}><span>{l}</span><Switch checked={!!f[k]} onChange={(v) => setF({ ...f, [k]: v })} label={l} /></div>;
  return <Sheet title={isNew ? "Nouvel article" : f.name} sub={isNew ? "Ajouté au catalogue partagé" : `Identifiant : ${item.id}`} onClose={onClose}>
    <label className="field">Nom</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
    <label className="field">Alias (séparés par des virgules)</label><input className="input" value={aliases} onChange={(e) => setAliases(e.target.value)} />
    <label className="field">Rayon</label>
    <div className="chips">{CAT_ORDER.map((c) => <button key={c} className="chip" aria-pressed={f.category === c} onClick={() => setF({ ...f, category: c })}>{CATS[c].icon} {CATS[c].label}</button>)}</div>
    <div className="grid2">
      <div><label className="field">Unité</label><select className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value as Unit })}><option value="g">grammes</option><option value="ml">millilitres</option><option value="pc">pièces</option></select></div>
      <div><label className="field">Format courant</label><input className="input" type="number" min={1} value={f.packSize} onChange={(e) => setF({ ...f, packSize: Number(e.target.value) || 1 })} /></div>
      <div><label className="field">Prix de démonstration (€)</label><input className="input" type="number" min={0} step={0.01} value={f.demoPrice} onChange={(e) => setF({ ...f, demoPrice: Number(e.target.value) || 0 })} /></div>
      <div><label className="field">Conservation (jours)</label><input className="input" type="number" min={1} value={f.shelfLifeDays} onChange={(e) => setF({ ...f, shelfLifeDays: Number(e.target.value) || 1 })} /></div>
    </div>
    {flag("local", "Produit en Belgique")}{flag("organicAvailable", "Existe en bio")}{flag("perishable", "Périssable")}{flag("staple", "Fond de placard (sel, épices…)")}{flag("common", "Courant (mise en place rapide)")}{flag("ready", "Plat préparé (à réchauffer, à part des ingrédients)")}
    <label className="field">Allergènes</label>
    <div className="chips">{(Object.keys(ALLERGENS) as Allergen[]).map((a) => <label key={a} className="chip"><Check checked={f.allergens.includes(a)} onChange={(v) => setF({ ...f, allergens: v ? [...f.allergens, a] : f.allergens.filter((x) => x !== a) })} label={ALLERGENS[a]} />{ALLERGENS[a]}</label>)}</div>
    <label className="field">Mois de saison</label>
    <div className="chips">{[...Array(12)].map((_, m) => <button key={m} className="chip" aria-pressed={f.seasonMonths.includes(m + 1)} onClick={() => setF({ ...f, seasonMonths: f.seasonMonths.includes(m + 1) ? f.seasonMonths.filter((x) => x !== m + 1) : [...f.seasonMonths, m + 1].sort((a, b) => a - b) })}>{new Date(2026, m, 1).toLocaleDateString("fr-BE", { month: "short" })}</button>)}</div>
    <button className="btn block" style={{ marginTop: 16 }} onClick={save}>Enregistrer</button>
    {!isNew && <MergeOrDelete item={item} onDone={onClose} />}
  </Sheet>;
}

function RecipesAdmin() {
  const s = useStore();
  return <div className="list">{BASE_RECIPES.map((r) => {
    const hidden = s.recipes.get(r.id)?.deleted;
    return <div key={r.id} className="li"><span className="main-t"><span className="name">{r.name}</span><span className="meta"><span>⏱ {r.prepMin} min</span><span>{r.seasons.join(" ")}</span>{hidden && <span className="tag bad">masquée</span>}</span></span>
      <button className="btn soft sm" onClick={() => run(() => setDoc(doc(db, "recipes", r.id), { ...JSON.parse(JSON.stringify(r)), householdId: null, deleted: !hidden }), hidden ? "Recette réactivée" : "Recette masquée pour tous")}>{hidden ? "Réactiver" : "Masquer"}</button></div>;
  })}</div>;
}

/** Fusion d'un article dans un autre, ou suppression d'un article ajouté par l'IA. */
function MergeOrDelete({ item, onDone }: { item: Item; onDone: () => void }) {
  const s = useStore();
  const [target, setTarget] = useState("");
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const into = s.idx.find(target);
  const merge = async () => {
    if (!into || into.id === item.id) return toast("Choisis l'article dans lequel fusionner");
    setBusy(true);
    const r = await run(() => adminMergeItems({ from: item.id, into: into.id }));
    setBusy(false);
    if (r) { toast(`Fusionné dans « ${into.name} » : ${r.moved.prices} prix, ${r.moved.stock} stocks, ${r.moved.recipes} recettes`); onDone(); }
  };
  return <div className="card" style={{ marginTop: 16, background: "var(--bg)" }}>
    <h3>Doublon ?</h3>
    {item.source === "base" ? <p>Article de base : fusionne plutôt les doublons dans celui-ci (depuis leur fiche, ou l'onglet « Doublons probables »).</p> : <>
      <p>Fusionne « {item.name} » dans un autre article : prix, stocks, listes de courses, historique et recettes sont regroupés, puis cet article disparaît.</p>
      <div className="row">
        <input className="input" list="merge-items" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Fusionner dans… (ex. Cacahuètes)" />
        <datalist id="merge-items">{s.idx.all().filter((i) => i.id !== item.id && i.unit === item.unit).map((i) => <option key={i.id} value={i.name} />)}</datalist>
        <button className="btn sm" disabled={busy || !into} onClick={merge}>Fusionner</button>
      </div>
      <button className="btn danger sm" style={{ marginTop: 10 }} disabled={busy} onClick={async () => {
        if (!armed) { setArmed(true); toast("Touche encore pour supprimer définitivement cet article et ses prix"); return; }
        setBusy(true); const r = await run(() => adminDeleteItem({ id: item.id }), "Article supprimé"); setBusy(false); if (r) onDone();
      }}>{armed ? "Confirmer la suppression" : "Supprimer cet article"}</button>
    </>}
  </div>;
}

/** Liste des doublons probables avec fusion en un clic. */
function Duplicates() {
  const s = useStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [swap, setSwap] = useState<Record<string, boolean>>({});
  const dups = useMemo(() => findDuplicates(s.idx.all()), [s.idx]); // calculé une fois, seulement dans cet onglet
  if (!dups.length) return <div className="empty">Aucun doublon probable. 👌</div>;
  return <>
    <p className="small muted">Articles aux noms très proches (même rayon, même unité). Vérifie le sens de la fusion : l'article de gauche disparaît, celui de droite garde tout. ⇄ inverse le sens.</p>
    <div className="list">{dups.map((d) => {
      const k = d.from.id + "|" + d.into.id;
      const [from, into] = swap[k] ? [d.into, d.from] : [d.from, d.into];
      return <div key={k} className="li">
        <span className="main-t"><span className="name">{from.name} → {into.name}</span>
          <span className="meta"><span>{CATS[into.category].icon} {CATS[into.category].label}</span><span>ressemblance {Math.round(d.score * 100)} %</span>{into.source === "base" && <span className="tag ac">vers un article de base</span>}</span></span>
        {from.source !== "base" && into.source !== "base" && <button className="ib" aria-label="Inverser" onClick={() => setSwap((x) => ({ ...x, [k]: !x[k] }))}>⇄</button>}
        <button className="btn sm" disabled={!!busy || from.source === "base"} onClick={async () => {
          setBusy(k); const r = await run(() => adminMergeItems({ from: from.id, into: into.id })); setBusy(null);
          if (r) toast(`« ${from.name} » fusionné dans « ${into.name} »`);
        }}>{busy === k ? "…" : "Fusionner"}</button>
      </div>;
    })}</div>
  </>;
}
