import { CaptureProgress } from "./CaptureProgress";
import { useEffect, useRef, useState } from "react";
import type { StoreId } from "../lib/types";
import { STORES } from "../lib/constants";
import { eur } from "../lib/text";
import { extractPricesFn } from "../state/actions";
import { useStore } from "../state/store";
import { Empty, toast, TopBar } from "../ui";

const HOSTS: [RegExp, StoreId][] = [[/colruyt\.be|collectandgo\.be/, "colruyt"], [/renmans\.be/, "renmans"], [/delhaize\.be/, "delhaize"], [/carrefour\.be/, "carrefour"], [/ah\.be/, "ah"], [/lidl\.be/, "lidl"], [/aldi\.be/, "aldi"], [/intermarche\.be/, "intermarche"]];

/** Page ouverte par le favori « Envoyer à Stoemp » : reçoit le texte de la page du magasin et en extrait les prix. */
export default function Capture() {
  const s = useStore();
  const [state, setState] = useState<{ phase: "wait" | "busy" | "done" | "error"; msg?: string; store?: StoreId; saved?: { itemId: string; productName: string; packPrice: number }[]; found?: number; created?: string[]; shop?: string | null; reader?: string; queued?: number; paused?: boolean }>({ phase: "wait" });
  // Sites qui coupent le lien entre onglets : le favori a aussi copié la page, on propose de la coller.
  const [pasteOffer, setPasteOffer] = useState(false);
  const handler = useRef<(d: unknown) => void>(() => {});
  const fromClipboardText = (txt: string) => {
    const i = txt.indexOf("STOEMP-CAPTURE");
    if (i < 0) { setState({ phase: "error", msg: "Ce n'est pas une page copiée par « Envoyer à Stoemp ». Retourne sur le magasin et touche à nouveau le favori." }); return; }
    try { handler.current(JSON.parse(txt.slice(i + "STOEMP-CAPTURE".length).trim())); }
    catch { setState({ phase: "error", msg: "Page copiée incomplète : renvoie-la depuis le magasin." }); }
  };
  const pasteNow = async () => {
    try { fromClipboardText(await navigator.clipboard.readText()); }
    catch { toast("Ton navigateur demande de coller toi-même : appui long dans le cadre puis « Coller » (ou Ctrl+V)."); }
  };
  useEffect(() => {
    let done = false;
    const timer = setTimeout(() => setPasteOffer(true), 3000);
    const onMsg = async (e: MessageEvent) => {
      // Le favori envoie plusieurs fois par sécurité : on ne traite que le premier envoi.
      const d = e.data;
      if (done || !d || d.type !== "stoemp-capture" || typeof d.text !== "string") return;
      clearTimeout(timer);
      const store = HOSTS.find(([re]) => re.test(String(d.host)))?.[1];
      if (!store) { setState({ phase: "error", msg: "Ce site n'est pas une enseigne connue." }); return; }
      done = true;
      setState({ phase: "busy", store });
      try {
        const r = await extractPricesFn({ store, url: String(d.url).slice(0, 500), text: d.text.slice(0, 1000000) });
        setState({ phase: "done", store, saved: r.saved, found: r.found, created: r.created, shop: r.shop, reader: r.reader, queued: r.queued, paused: r.paused });
      } catch (err) { setState({ phase: "error", msg: (err as Error).message }); }
    };
    handler.current = (d: unknown) => onMsg({ data: d } as MessageEvent);
    addEventListener("message", onMsg);
    try { window.opener?.postMessage("stoemp-ready", "*"); } catch { /* lien coupé par le site : on passera par le presse-papiers */ }
    return () => { clearTimeout(timer); removeEventListener("message", onMsg); };
  }, []);
  return <>
    <TopBar title="Capteur de prix" sub={state.shop || (state.store ? STORES[state.store].label : undefined)} />
    <div className="content">
      {state.phase === "wait" && <Empty icon="📥">En attente de la page du magasin…<br />Sur le site du magasin, touche le favori « Envoyer à Stoemp », attends que tout soit chargé, puis clique « 📥 Envoyer à Stoemp » dans l'encadré.</Empty>}
      {state.phase === "wait" && pasteOffer && <div className="card" style={{ marginTop: 12 }}>
        <h3>📋 Rien n'arrive ?</h3>
        <p className="small muted">Certains sites (Carrefour, Renmans…) coupent le lien entre les onglets. La page a aussi été copiée : colle-la ici.</p>
        <button className="btn block" onClick={pasteNow}>📋 Coller la page copiée</button>
        <textarea className="input" rows={2} style={{ marginTop: 8 }} placeholder="…ou appui long ici puis « Coller » (Ctrl+V sur ordinateur)" aria-label="Coller la page copiée"
          onPaste={(e) => { e.preventDefault(); fromClipboardText(e.clipboardData.getData("text")); }} />
      </div>}
      {state.phase === "busy" && <Empty icon="🔎">Lecture des prix…<br />Une catégorie entière peut prendre une minute (plus si beaucoup de nouveaux articles) : garde cette page ouverte.</Empty>}
      {state.phase === "error" && <Empty icon="⚠️">{state.msg}</Empty>}
      {state.phase === "done" && <>
        <div className="notice">{state.found} produits lus{state.shop ? ` chez ${state.shop}` : ""}, {state.saved!.length} prix enregistrés{state.created?.length ? `, ${state.created.length} nouveaux articles ajoutés au catalogue` : ""}{state.reader ? ` · lecture ${state.reader}` : ""}.</div>
        <CaptureProgress />
        {!!state.created?.length && <p className="small muted">Nouveaux articles : {state.created.join(", ")}</p>}
        <div className="list">{state.saved!.map((p) => <div key={p.itemId} className="li"><span className="main-t"><span className="name">{s.idx.get(p.itemId)?.name || p.itemId}</span><span className="meta">{p.productName}</span></span><b className="num">{eur(p.packPrice)}</b></div>)}</div>
        <button className="btn block" style={{ marginTop: 14 }} onClick={() => window.close()}>Fermer et revenir au magasin</button>
      </>}
    </div>
  </>;
}
