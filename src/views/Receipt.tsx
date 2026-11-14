import { useState } from "react";
import { Camera } from "lucide-react";
import { STORES, STORE_ORDER } from "../lib/constants";
import { today, ymd } from "../lib/season";
import { eur } from "../lib/text";
import type { StoreId } from "../lib/types";
import { applyReceipt, readReceiptFn, type ReceiptLine } from "../state/actions";
import { useStore } from "../state/store";
import { fileToJpegBase64, run, Sheet, toast } from "../ui";

/** Photo du ticket → Claude le lit → vérification → stock, prix payés et historique d'achats mis à jour. */
export default function ReceiptSheet({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<ReceiptLine[] | null>(null);
  const [store, setStore] = useState<StoreId>("colruyt");
  const [date, setDate] = useState(ymd(today()));

  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (!s.online) return toast("Il faut une connexion pour lire le ticket");
    setBusy(true);
    const r = await run(async () => readReceiptFn({ householdId: s.hid!, image: await fileToJpegBase64(f), mediaType: "image/jpeg" }));
    setBusy(false);
    if (!r) return;
    setLines(r.lines);
    if (r.store !== "autre") setStore(r.store as StoreId);
    if (r.date) setDate(r.date);
  };
  const update = (i: number, patch: Partial<ReceiptLine>) => setLines((L) => L!.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const matched = lines?.filter((l) => l.itemId).length || 0;

  return (
    <Sheet title="Ticket de caisse" sub="Prix payés, stock et habitudes d'achat mis à jour d'un coup" onClose={onClose}>
      {!lines ? (
        <label className="btn block" style={{ marginTop: 10 }}>
          <Camera size={18} />{busy ? "Lecture du ticket…" : "Prendre une photo du ticket"}
          <input type="file" accept="image/*" capture="environment" hidden disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
        </label>
      ) : (
        <>
          <div className="row" style={{ margin: "8px 0" }}>
            <select className="input" value={store} onChange={(e) => setStore(e.target.value as StoreId)}>{STORE_ORDER.map((k) => <option key={k} value={k}>{STORES[k].label}</option>)}</select>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <p className="small muted">{matched}/{lines.length} lignes reconnues. Corrige le nom d'une ligne pour la relier au catalogue ; décoche ce qui ne doit pas entrer dans le stock.</p>
          <div className="list">{lines.map((l, i) => {
            const it = l.itemId ? s.idx.get(l.itemId) : undefined;
            return <div className="li" key={i}>
              <input type="checkbox" className="check" checked={!!l.itemId} onChange={(e) => update(i, { itemId: e.target.checked ? s.idx.find(l.name)?.id || null : null })} aria-label="Inclure" />
              <div className="main-t">
                <input className="input" style={{ minHeight: 36, padding: "6px 10px" }} defaultValue={it?.name || l.name}
                  onBlur={(e) => update(i, { name: e.target.value, itemId: s.idx.find(e.target.value)?.id || null })} aria-label="Article" />
                <div className="meta"><span>{l.label}</span><span>× {l.quantity}</span>{!it && <span className="tag bad">non relié</span>}</div>
              </div>
              <b className="num">{eur(l.totalPrice)}</b>
            </div>;
          })}</div>
          <button className="btn block" style={{ marginTop: 14 }} onClick={async () => { await run(() => applyReceipt(s, store, date, lines), "Ticket enregistré : stock et prix à jour"); onClose(); }}>Valider {matched} article{matched > 1 ? "s" : ""}</button>
        </>
      )}
    </Sheet>
  );
}
