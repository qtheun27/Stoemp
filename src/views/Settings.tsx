import { useEffect, useRef, useState } from "react";
import { GoogleAuthProvider, linkWithPopup, signOut } from "firebase/auth";
import { Copy, LogOut, Share2, ShieldCheck, UserPlus } from "lucide-react";
import { auth } from "../firebase";
import { STORES, STORE_ORDER, WEEKDAYS_SUN0 } from "../lib/constants";
import type { StoreId } from "../lib/types";
import { createHousehold, createInvite, leaveHousehold, removeMember, renameHousehold, saveSettings, setRole, switchHousehold } from "../state/actions";
import { useStore } from "../state/store";
import { copyText, run, Switch, toast, TopBar } from "../ui";

export const appUrl = () => location.origin + location.pathname;
/**
 * Favori « Envoyer à Stoemp » : reste sur la page du magasin (au premier plan, sinon Chrome la met en veille),
 * clique lui-même sur « Voir plus » jusqu'à ce que toute la catégorie soit chargée, puis propose un bouton
 * « Envoyer à Stoemp » : ce clic ouvre Stoemp (autorisé par le navigateur) et transmet le texte de la page.
 */
const BOOKMARKLET_SRC = `(async()=>{
const z=t=>new Promise(r=>setTimeout(r,t));
const b=document.createElement("div");
b.style.cssText="position:fixed;z-index:2147483647;top:12px;right:12px;background:#1d2a22;color:#fff;padding:12px 16px;border-radius:14px;font:600 14px system-ui;box-shadow:0 6px 24px rgba(0,0,0,.3);max-width:320px";
document.body.appendChild(b);
const re=/^(voir plus|afficher plus|plus de produits|charger plus|meer laden|toon meer|meer producten)/i;
const cnt=()=>document.links.length+document.images.length;
let last=cnt(),n=0;
for(;n<150;n++){
const btn=[...document.querySelectorAll("button,a,[role=button]")].find(e=>e.offsetParent&&re.test((e.innerText||"").trim()));
if(!btn)break;
b.textContent="Stoemp : chargement des produits… ("+(n+1)+") — garde cet onglet ouvert";
btn.scrollIntoView({block:"center"});btn.click();
let grew=false;for(let i=0;i<60;i++){await z(250);if(cnt()>last){grew=true;break}}
if(!grew)break;
let c=cnt(),still=0;for(let i=0;i<40&&still<4;i++){await z(250);const c2=cnt();if(c2===c)still++;else{c=c2;still=0}}
last=c;
}
let text=document.body.innerText;
if(/colruyt[.]be/.test(location.hostname)){
const u=new URL(location.href);let p=Number(u.searchParams.get("page")||"1");
for(let k=0;k<3;k++){
p++;u.searchParams.set("page",String(p));
b.textContent="Stoemp : recherche des produits cachés par les publicités… ("+(k+1)+"/3)";
const f=document.createElement("iframe");f.style.cssText="position:fixed;left:-9999px;top:0;width:1280px;height:2400px";f.src=u.href;document.body.appendChild(f);
let t="";for(let i=0;i<40;i++){await z(500);try{t=f.contentDocument.body.innerText}catch(e){break}if(i>8&&/[0-9]+,[0-9]{2,3}[/](kg|pce)/.test(t))break}
f.remove();
const m=t.match(/[0-9]+,[0-9]{2,3}[/](kg|pce|l)/g);if(!m)break;text+=String.fromCharCode(10)+t;
}
}
const d={type:"stoemp-capture",host:location.hostname,url:location.href,text:text.slice(0,1000000)};
b.innerHTML="";
const t=document.createElement("div");t.textContent="Stoemp : tout est chargé ("+n+" « Voir plus »)"+(text.length>1000000?" — page très longue : envoie plutôt par sous-catégorie.":".");
const go=document.createElement("button");go.textContent="📥 Envoyer à Stoemp";
go.style.cssText="margin-top:10px;width:100%;padding:10px;border:0;border-radius:10px;background:#68a83c;color:#fff;font:700 15px system-ui;cursor:pointer";
b.append(t,go);
go.onclick=()=>{
const w=window.open(APP,"stoemp");
const s=()=>w&&w.postMessage(d,"*");
addEventListener("message",e=>{if(e.data==="stoemp-ready")s()});
[1000,2500,5000,9000].forEach(x=>setTimeout(s,x));
t.textContent="Envoyé ✓ — la lecture se poursuit dans l'onglet Stoemp.";go.remove();setTimeout(()=>b.remove(),8000);
};
})()`;
export const bookmarklet = () => "javascript:" + encodeURIComponent(BOOKMARKLET_SRC.replace("APP", JSON.stringify(appUrl() + "#/capture")).replace(/\n/g, ""));

type Theme = "auto" | "light" | "dark";
export function applyTheme(t: Theme) {
  if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.dataset.theme = t;
  try { localStorage.setItem("stoemp-theme", t); } catch { /* ignoré */ }
}

export default function Settings() {
  const s = useStore();
  const st = s.settings;
  const [theme, setTheme] = useState<Theme>(() => { try { return (localStorage.getItem("stoemp-theme") as Theme) || "auto"; } catch { return "auto"; } });
  const [invite, setInvite] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [install, setInstall] = useState<(Event & { prompt: () => void }) | null>(null);
  useEffect(() => { const f = (e: Event) => { e.preventDefault(); setInstall(e as Event & { prompt: () => void }); }; addEventListener("beforeinstallprompt", f); return () => removeEventListener("beforeinstallprompt", f); }, []);
  const bm = useRef<HTMLAnchorElement>(null);
  useEffect(() => { bm.current?.setAttribute("href", bookmarklet()); }, []);
  const u = s.user!;
  const admin = s.isAdmin;
  const save = (p: Parameters<typeof saveSettings>[1]) => run(() => saveSettings(s.hid!, p));
  const toggleStore = (k: StoreId) => save({ stores: st.stores.includes(k) ? st.stores.filter((x) => x !== k) : [...st.stores, k] });
  const makeInvite = async () => { const r = await run(() => createInvite({ householdId: s.hid! })); if (r) setInvite(`${appUrl()}#/rejoindre/${r.token}`); };
  const shareInvite = async () => {
    if (!invite) return;
    try { if (navigator.share) { await navigator.share({ title: "Rejoins notre foyer sur Stoemp", url: invite }); return; } } catch { return; }
    toast((await copyText(invite)) ? "Lien copié" : "Copie impossible");
  };

  return (
    <>
      <TopBar title="Réglages" sub={s.household?.name}>
        {s.superAdmin && <a className="ib" href="#/admin" aria-label="Console d'administration"><ShieldCheck size={20} /></a>}
      </TopBar>
      <div className="content wide">
        {s.superAdmin && <a className="notice" href="#/admin" style={{ textDecoration: "none", color: "inherit" }}><ShieldCheck size={20} /><span className="grow"><b>Console d'administration</b><br /><span className="small muted">Tableau de bord, utilisateurs, catalogue, prix, IA</span></span><span aria-hidden>›</span></a>}
        <div className="grid2">
          <div className="stack">
            <div className="card">
              <h3>Foyer</h3>
              <p>{admin ? "Tu es admin : tu gères les membres et les réglages." : "Tu es membre de ce foyer."}</p>
              {admin && <input className="input" defaultValue={s.household?.name} onBlur={(e) => e.target.value.trim() && run(() => renameHousehold(s.hid!, e.target.value.trim()))} aria-label="Nom du foyer" />}
              <label className="field">Membres</label>
              {Object.entries(s.household?.members || {}).map(([id, role]) => <div key={id} className="row between" style={{ padding: "6px 0" }}>
                <span>{s.household?.memberNames?.[id] || "Membre"}{id === u.uid ? " (moi)" : ""} <span className="tag">{role === "admin" ? "admin" : "membre"}</span></span>
                {admin && id !== u.uid && <span className="row">
                  <button className="btn soft sm" onClick={() => run(() => setRole(s.hid!, id, role === "admin" ? "member" : "admin"))}>{role === "admin" ? "→ membre" : "→ admin"}</button>
                  <button className="btn soft sm" onClick={() => run(() => removeMember(s.hid!, id), "Membre retiré")}>Retirer</button></span>}
              </div>)}
              {admin && s.app.features.invites && <div style={{ marginTop: 10 }}>
                {!invite ? <button className="btn" onClick={makeInvite}><UserPlus size={18} />Inviter quelqu'un</button> :
                  <div className="row"><input className="input" readOnly value={invite} onFocus={(e) => e.target.select()} /><button className="ib" onClick={shareInvite} aria-label="Partager"><Share2 size={18} /></button></div>}
                {invite && <p className="small muted">Lien valable 7 jours.</p>}
              </div>}
              {s.households.length > 1 && <><label className="field">Changer de foyer</label>
                <div className="chips">{s.households.map((h) => <button key={h.id} className="chip" aria-pressed={h.id === s.hid} onClick={() => run(() => switchHousehold(h.id))}>{h.name}</button>)}</div></>}
              {s.app.features.multiHousehold && <form className="row" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); if (newName.trim()) { run(() => createHousehold(newName.trim(), false, s.app.defaults), "Foyer créé"); setNewName(""); } }}>
                <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Créer un autre foyer" /><button className="btn soft">Créer</button>
              </form>}
              {s.households.length > 1 && <button className="btn soft sm" style={{ marginTop: 10 }} onClick={() => run(() => leaveHousehold(s.hid!, s.households.filter((h) => h.id !== s.hid).map((h) => h.id)), "Foyer quitté")}>Quitter ce foyer</button>}
            </div>

            <div className="card">
              <h3>Magasins fréquentés</h3>
              <p>Les prix et la vue par magasin se basent sur ces enseignes.{!admin && " (Réglage réservé à l'admin.)"}</p>
              <div className="chips">{STORE_ORDER.map((k) => <button key={k} className="chip" disabled={!admin} aria-pressed={st.stores.includes(k)} onClick={() => toggleStore(k)}>{STORES[k].label}</button>)}</div>
              <label className="field">Prix utilisés pour les coûts des repas</label>
              <select className="input" disabled={!admin} value={st.preferredStore} onChange={(e) => save({ preferredStore: e.target.value as StoreId | "cheapest" })}>
                <option value="cheapest">Le moins cher parmi mes magasins</option>
                {st.stores.map((k) => <option key={k} value={k}>{STORES[k].label}</option>)}
              </select>
              <label className="field">Mon magasin, par enseigne</label>
              <p className="small muted" style={{ margin: "0 0 6px" }}>Indique ton magasin habituel (et pour Carrefour son format : Hyper, Market ou Express) ; le magasin lu sur les pages envoyées est aussi gardé avec chaque prix.</p>
              <div className="grid2">{st.stores.map((k) => {
                const cur = st.shops?.[k] ?? (k === "colruyt" ? st.myColruytStore : k === "renmans" ? st.renmansShop : "") ?? "";
                return <div key={k}><label className="field">{STORES[k].label}</label><input className="input" disabled={!admin} defaultValue={cur}
                  placeholder={k === "carrefour" ? "ex. Carrefour Market Mons" : `ex. ${STORES[k].label} Mons`} onBlur={(e) => save({ shops: { ...(st.shops || {}), [k]: e.target.value.trim() } })} /></div>;
              })}</div>
              <label className="field">Jours de courses</label>
              <div className="chips">{[1, 2, 3, 4, 5, 6, 0].map((d) => <button key={d} className="chip" disabled={!admin} aria-pressed={st.shoppingDays.includes(d)}
                onClick={() => save({ shoppingDays: st.shoppingDays.includes(d) ? st.shoppingDays.filter((x) => x !== d) : [...st.shoppingDays, d] })}>{WEEKDAYS_SUN0[d].slice(0, 3)}</button>)}</div>
            </div>
          </div>

          <div className="stack">
            {s.app.features.capture && <div className="card">
              <h3>📥 Capteur de prix</h3>
              <p>Sur le site de Colruyt, Delhaize, Carrefour, Albert Heijn ou Renmans, ouvre une catégorie (ex. Légumes et fruits) ou fais une recherche, puis touche ce favori : il charge lui-même tous les produits (« Voir plus ») et envoie leurs prix à Stoemp. Le robot hebdomadaire s'occupe de Renmans tout seul.</p>
              <div className="row wrap">
                <a className="btn" ref={bm} href="#" onClick={(e) => { e.preventDefault(); toast("Glisse ce bouton dans ta barre de favoris"); }}>📥 Envoyer à Stoemp</a>
                <button className="btn ghost" onClick={async () => toast((await copyText(bookmarklet())) ? "Code copié" : "Copie impossible")}><Copy size={18} />Copier le code</button>
              </div>
              <details style={{ marginTop: 10 }}><summary className="small"><b>Sur iPhone ou iPad</b></summary>
                <ol className="small muted">
                  <li>Touche « Copier le code ».</li>
                  <li>Dans Safari, ajoute cette page aux signets, puis modifie le signet : nom « Envoyer à Stoemp », et colle le code à la place de l'adresse.</li>
                  <li>Sur colruyt.be, ouvre les signets et touche « Envoyer à Stoemp ».</li>
                </ol></details>
              <p className="small muted">Autres sources : photo des tickets de caisse (onglet Courses ou Stock) et robot Colruyt sur ton ordinateur, chaque dimanche. Les prix ne sont jamais publiés.</p>
            </div>}

            <div className="card">
              <h3>Apparence</h3>
              <div className="chips">{(["auto", "light", "dark"] as Theme[]).map((t) => <button key={t} className="chip" aria-pressed={theme === t} onClick={() => { setTheme(t); applyTheme(t); }}>{t === "auto" ? "Automatique" : t === "light" ? "Clair" : "Sombre"}</button>)}</div>
              {install && <button className="btn" style={{ marginTop: 12 }} onClick={() => install.prompt()}>Installer l'appli</button>}
              <p className="small muted" style={{ marginTop: 10 }}>Sur iPhone : Partager → « Sur l'écran d'accueil ». L'appli marche ensuite hors ligne avec les dernières données.</p>
            </div>

            <div className="card">
              <h3>Compte</h3>
              <p>{u.isAnonymous ? "Mode démo : relie ton compte Google pour retrouver tes données partout." : `${u.displayName || ""} · ${u.email || ""}`}</p>
              <div className="row wrap">
                {u.isAnonymous && <button className="btn" onClick={() => run(() => linkWithPopup(u, new GoogleAuthProvider()), "Compte Google relié")}>Relier mon compte Google</button>}
                <button className="btn ghost" onClick={() => signOut(auth)}><LogOut size={18} />Se déconnecter</button>
              </div>
            </div>
            <div className="row between small muted" style={{ padding: "0 4px" }}><span>Stoemp · {s.online ? "en ligne" : "hors ligne"}</span><span>Notifications : <Switch checked={false} onChange={() => toast("Les rappels arrivent dans une prochaine version")} label="Notifications" /></span></div>
          </div>
        </div>
      </div>
    </>
  );
}
