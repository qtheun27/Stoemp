import { useState } from "react";
import { TopBar } from "../../ui";
import Dashboard from "./Dashboard";
import Users from "./Users";
import Households from "./Households";
import AiSettings from "./AiSettings";
import AppSettings from "./AppSettings";
import Catalog from "./Catalog";
import Prices from "./Prices";
import Library from "./Library";

const TABS = [
  ["dash", "📊 Tableau de bord", Dashboard], ["users", "👤 Utilisateurs", Users], ["hh", "🏠 Foyers", Households],
  ["ai", "✨ IA", AiSettings], ["app", "🎛 Appli", AppSettings], ["cat", "🥕 Catalogue", Catalog], ["lib", "📚 Recettes", Library], ["prices", "🏷 Prix & robot", Prices],
] as const;

export default function Admin() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>(() => { try { return (sessionStorage.getItem("admin-tab") as never) || "dash"; } catch { return "dash"; } });
  const Cur = TABS.find((t) => t[0] === tab)![2];
  return (
    <>
      <TopBar title="Console d'administration" sub="Réglages en direct · données de tous les foyers" />
      <div className="content wide">
        <div className="admin-tabs"><div className="scroll-x" style={{ margin: 0, padding: 0 }}>
          {TABS.map(([k, label]) => <button key={k} className="chip" aria-pressed={tab === k} onClick={() => { setTab(k); try { sessionStorage.setItem("admin-tab", k); } catch { /* ignoré */ } }}>{label}</button>)}
        </div></div>
        <Cur />
      </div>
    </>
  );
}
