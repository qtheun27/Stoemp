import { useState } from "react";
import { Sparkles } from "lucide-react";
import { eatersOf, headcount } from "../lib/household";
import { receive } from "../state/actions";
import { useStore } from "../state/store";
import { Check, run, Sheet, Stepper } from "../ui";

type Course = "aperitif" | "entree" | "dessert";
const LABEL: Record<Course, string> = { aperitif: "🥂 Apéritif", entree: "🥗 Entrée", dessert: "🍰 Dessert" };

/** Mode « Je reçois » : invités, services voulus, budget ; l'IA compose le menu et les boissons. */
export default function ReceptionSheet({ slotIndex, onClose, onDone }: { slotIndex: number; onClose: () => void; onDone: () => void }) {
  const s = useStore();
  const e = eatersOf(s.settings);
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState(0);
  const [courses, setCourses] = useState<Course[]>(["aperitif", "entree", "dessert"]);
  const [newMain, setNewMain] = useState(false);
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);
  const total = headcount(e) + adults + kids;
  const toggle = (c: Course) => setCourses((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c]));
  const go = async () => {
    setBusy(true);
    const b = parseFloat(budget.replace(",", "."));
    const r = await run(() => receive(s, slotIndex, { adults, kids, courses, newMain, budgetPerHead: isFinite(b) && b > 0 ? b : null }), "Menu de réception prêt 🎉");
    setBusy(false);
    if (r !== undefined) onDone();
  };
  return <Sheet title="🎉 Je reçois" sub={`Ton foyer + tes invités : ${total} personnes`} onClose={onClose}>
    <div className="row wrap" style={{ gap: 16 }}>
      <div><div className="small muted">Invités adultes</div><Stepper value={adults} min={0} max={30} onChange={setAdults} /></div>
      <div><div className="small muted">Invités enfants</div><Stepper value={kids} min={0} max={20} onChange={setKids} /></div>
    </div>
    <label className="field">Services</label>
    <div className="chips">{(Object.keys(LABEL) as Course[]).map((c) => <label key={c} className="chip"><Check checked={courses.includes(c)} onChange={() => toggle(c)} label={LABEL[c]} />{LABEL[c]}</label>)}</div>
    <label className="row small" style={{ marginTop: 10 }}><Check checked={newMain} onChange={setNewMain} label="Nouveau plat principal" />Proposer aussi un plat principal plus festif (sinon on garde le plat prévu)</label>
    <label className="field">Budget par convive (facultatif)</label>
    <div className="row"><input className="input num-in" inputMode="decimal" value={budget} onChange={(ev) => setBudget(ev.target.value)} placeholder="ex. 15" /><span className="small muted">€ pour tout le repas</span></div>
    <p className="small muted">L'IA compose un menu harmonieux et de saison, avec des boissons (dont une sans alcool), en respectant les allergies et ingrédients à éviter du foyer. Tout part dans la liste de courses pour {total} personnes.</p>
    <button className="btn block" disabled={busy || (!courses.length && !newMain) || !s.online} onClick={go}><Sparkles size={18} />{busy ? "Le chef compose ton menu…" : "Composer le menu"}</button>
  </Sheet>;
}
