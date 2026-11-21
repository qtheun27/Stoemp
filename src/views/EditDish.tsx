import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { norm } from "../lib/text";
import type { Ingredient, Recipe } from "../lib/types";
import { basePortions, updateRecipe } from "../state/actions";
import { useStore } from "../state/store";
import { run, Sheet, Stepper } from "../ui";

type Row = Ingredient & { part: "meat" | "base" };
const UNIT: Record<string, string> = { g: "g", ml: "ml", pc: "pièce(s)" };

/**
 * Modifier un plat perso : nom, durée, présentation et quantités. Les quantités se saisissent pour tout le foyer
 * (comme on cuisine) et sont enregistrées par personne.
 */
export function EditDish({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const s = useStore();
  const [n, setN] = useState(Math.max(1, Math.round(basePortions(s))));
  const [name, setName] = useState(recipe.name);
  const [prep, setPrep] = useState(recipe.prepMin);
  const [desc, setDesc] = useState(recipe.desc || "");
  const [rows, setRows] = useState<Row[]>([...recipe.meat.map((g) => ({ ...g, part: "meat" as const })), ...recipe.ingredients.map((g) => ({ ...g, part: "base" as const }))]);
  const [q, setQ] = useState("");
  const found = useMemo(() => {
    const w = norm(q).trim();
    if (w.length < 2) return [];
    return [...s.idx.byId.values()].filter((i) => norm(i.name).includes(w) && !rows.some((r) => r.itemId === i.id)).slice(0, 6);
  }, [q, s.idx, rows]);
  const setQty = (k: number, total: number) => setRows(rows.map((r, j) => (j === k ? { ...r, qtyPerPerson: total / n } : r)));
  const save = () => {
    const clean = (part: Row["part"]) => rows.filter((r) => r.part === part && r.qtyPerPerson > 0).map(({ part: _p, ...g }) => g);
    run(() => updateRecipe(recipe.id, { name: name.trim() || recipe.name, prepMin: prep, desc: desc.trim() || null, meat: clean("meat"), ingredients: clean("base") }), "Plat enregistré");
    onClose();
  };
  return <Sheet title="Modifier le plat" onClose={onClose} actions={<button className="btn block" onClick={save}>Enregistrer</button>}>
    <label className="field">Nom</label>
    <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
    <label className="field">Présentation (facultatif)</label>
    <textarea className="input" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="ex. Salade de pâtes froide au thon, tomates cerises et basilic, parfaite en été" />
    <div className="row wrap" style={{ gap: 16, marginTop: 6 }}>
      <div><label className="field">Durée</label><Stepper value={prep} min={5} max={480} step={5} onChange={setPrep} fmt={(v) => `${v} min`} /></div>
      <div><label className="field">Quantités pour</label><Stepper value={n} min={1} max={20} onChange={setN} fmt={(v) => `${v} pers.`} /></div>
    </div>
    <label className="field">Ingrédients (pour {n} personne{n > 1 ? "s" : ""})</label>
    <div className="list">{rows.map((r, k) => { const it = s.idx.get(r.itemId); return <div key={r.itemId} className="li" style={{ gap: 8 }}>
      <span className="main-t"><span className="name">{it?.name || r.itemId}</span>{r.part === "meat" && <span className="meta">viande ou poisson (remplacé dans la version végé)</span>}</span>
      <input className="input" style={{ width: 84, textAlign: "right" }} inputMode="decimal" defaultValue={String(Math.round(r.qtyPerPerson * n * 10) / 10).replace(".", ",")}
        onBlur={(e) => { const v = parseFloat(e.target.value.replace(",", ".")); if (isFinite(v) && v >= 0) setQty(k, v); }} aria-label={`Quantité de ${it?.name}`} />
      <span className="small muted" style={{ width: 54 }}>{r.spoon ? (r.spoon === "cs" ? "c. à s." : "c. à c.") : UNIT[it?.unit || "g"]}</span>
      <button className="ib plain" aria-label={`Retirer ${it?.name}`} onClick={() => setRows(rows.filter((_, j) => j !== k))}><Trash2 size={17} /></button>
    </div>; })}</div>
    <div className="row" style={{ gap: 8, marginTop: 8 }}>
      <input className="input grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ajouter un ingrédient (ex. thon, maïs)" />
    </div>
    {!!found.length && <div className="chips" style={{ marginTop: 6 }}>{found.map((i) => <button key={i.id} className="chip" onClick={() => { setRows([...rows, { itemId: i.id, qtyPerPerson: (i.unit === "pc" ? 1 : 100) / n, part: i.category === "vi" ? "meat" : "base" }]); setQ(""); }}><Plus size={14} />{i.name}</button>)}</div>}
  </Sheet>;
}
