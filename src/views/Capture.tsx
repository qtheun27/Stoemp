import { useEffect, useState } from "react";
import type { StoreId } from "../lib/types";
import { STORES } from "../lib/constants";
import { eur } from "../lib/text";
import { extractPricesFn } from "../state/actions";
import { useStore } from "../state/store";
import { Empty, TopBar } from "../ui";

const HOSTS: [RegExp, StoreId][] = [[/colruyt\.be|collectandgo\.be/, "colruyt"], [/renmans\.be/, "renmans"], [/delhaize\.be/, "delhaize"], [/carrefour\.be/, "carrefour"], [/ah\.be/, "ah"], [/lidl\.be/, "lidl"], [/aldi\.be/, "aldi"], [/intermarche\.be/, "intermarche"]];

/** Page ouverte par le favori « Envoyer à Stoemp » : reçoit le texte de la page du magasin et en extrait les prix. */
export default function Capture() {
  const s = useStore();
  const [state, setState] = useState<{ phase: "wait" | "busy" | "done" | "error"; msg?: string; store?: StoreId; saved?: { itemId: string; productName: string; packPrice: number }[]; found?: number }>({ phase: "wait" });
  useEffect(() => {
    let done = false;
    const onMsg = async (e: MessageEvent) => {
      // Le favori envoie plusieurs fois par sécurité : on ne traite que le premier envoi.
      const d = e.data;
      if (done || !d || d.type !== "stoemp-capture" || typeof d.text !== "string") return;
      const store = HOSTS.find(([re]) => re.test(String(d.host)))?.[1];
      if (!store) { setState({ phase: "error", msg: "Ce site n'est pas une enseigne connue." }); return; }
      done = true;
      setState({ phase: "busy", store });
      try {
        const r = await extractPricesFn({ store, url: String(d.url).slice(0, 500), text: d.text.slice(0, 300000) });
        setState({ phase: "done", store, saved: r.saved, found: r.found });
      } catch (err) { setState({ phase: "error", msg: (err as Error).message }); }
    };
    addEventListener("message", onMsg);
    window.opener?.postMessage("stoemp-ready", "*");
    return () => removeEventListener("message", onMsg);
  }, []);
  return <>
    <TopBar title="Capteur de prix" sub={state.store ? STORES[state.store].label : undefined} />
    <div className="content">
      {state.phase === "wait" && <Empty icon="📥">Le magasin charge tous les produits de la page…<br />Garde cet onglet ouvert : la lecture démarre dès que tout est chargé.</Empty>}
      {state.phase === "busy" && <Empty icon="🔎">Lecture des prix…<br />Une catégorie entière peut prendre une à deux minutes : garde cette page ouverte.</Empty>}
      {state.phase === "error" && <Empty icon="⚠️">{state.msg}</Empty>}
      {state.phase === "done" && <>
        <div className="notice">{state.found} produits lus, {state.saved!.length} prix reliés à ton catalogue.</div>
        <div className="list">{state.saved!.map((p) => <div key={p.itemId} className="li"><span className="main-t"><span className="name">{s.idx.get(p.itemId)?.name || p.itemId}</span><span className="meta">{p.productName}</span></span><b className="num">{eur(p.packPrice)}</b></div>)}</div>
        <button className="btn block" style={{ marginTop: 14 }} onClick={() => window.close()}>Fermer et revenir au magasin</button>
      </>}
    </div>
  </>;
}
