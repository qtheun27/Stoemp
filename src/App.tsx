import { useEffect } from "react";
import { BookOpen, CalendarDays, Package, Settings as Cog, ShieldCheck, ShoppingCart } from "lucide-react";
import { lazy, Suspense } from "react";
import { planSeason } from "./lib/planner";
import { useRoute } from "./route";
import { useStore } from "./state/store";
import { Toasts } from "./ui";
import Capture from "./views/Capture";
import Dishes from "./views/Dishes";
import Login from "./views/Login";
import Onboarding from "./views/Onboarding";
import Settings from "./views/Settings";
import Shopping, { useShopping } from "./views/Shopping";
import Stock from "./views/Stock";
import Week from "./views/Week";

// La console d'administration est chargée à part : elle ne pèse rien pour les autres utilisateurs.
const Admin = lazy(() => import("./views/admin/Admin"));

const TABS = [
  { id: "semaine", label: "Semaine", Icon: CalendarDays },
  { id: "courses", label: "Courses", Icon: ShoppingCart },
  { id: "stock", label: "Stock", Icon: Package },
  { id: "plats", label: "Plats", Icon: BookOpen },
  { id: "reglages", label: "Réglages", Icon: Cog },
];

export default function App() {
  const s = useStore();
  const route = useRoute();
  const [page, arg] = route.split("/");

  // Couleur d'accent de la saison et couleur de la barre d'état.
  const season = planSeason(s.settings.options);
  useEffect(() => {
    document.documentElement.style.setProperty("--ac", `var(--${season})`);
  }, [season]);

  if (!s.authReady) return <div className="login"><div className="muted">Chargement…</div></div>;
  if (!s.user) return <><Login /><Toasts /></>;
  if (page === "rejoindre" && arg) return <><Onboarding token={arg} /><Toasts /></>;
  if (!s.userDoc) return <div className="login"><div className="muted">Chargement…</div></div>;
  if (s.app.maintenance.on && !s.superAdmin) return <div className="login"><div className="box"><div className="empty"><div className="big">🛠</div>{s.app.maintenance.message}</div></div></div>;
  if (page === "admin" && s.superAdmin) return <div className="app"><Nav current="admin" /><main className="main"><Suspense fallback={<div className="empty">Chargement…</div>}><Admin /></Suspense></main><Toasts /></div>;
  if (!s.hid) return <><Onboarding /><Toasts /></>;

  const current = TABS.some((t) => t.id === page) ? page : page === "capture" ? "capture" : "semaine";
  return (
    <div className="app">
      <Nav current={current} />
      <main className="main">
        {!s.online && <div style={{ background: "var(--warn)", color: "#fff", textAlign: "center", fontSize: 13, padding: "calc(var(--sat) + 2px) 8px 2px" }}>Hors ligne : dernières données, modifications synchronisées au retour du réseau</div>}
        {s.app.banner.text && <div className="content wide" style={{ paddingBottom: 0 }}><div className="notice" style={s.app.banner.tone === "warn" ? { background: "color-mix(in srgb, var(--warn) 18%, var(--card))" } : undefined}>📣 {s.app.banner.text}</div></div>}
        {current === "semaine" && <Week />}
        {current === "courses" && <Shopping />}
        {current === "stock" && <Stock />}
        {current === "plats" && <Dishes />}
        {current === "reglages" && <Settings />}
        {current === "capture" && <Capture />}
      </main>
      <Toasts />
    </div>
  );
}

function Nav({ current }: { current: string }) {
  const s = useStore();
  const { lines } = useShopping(s);
  const admin = s.superAdmin && <a href="#/admin" aria-current={current === "admin" ? "page" : undefined}><ShieldCheck size={22} />Admin</a>;
  const todo = lines.filter((l) => !l.checked).length;
  const link = (t: (typeof TABS)[number]) => (
    <a key={t.id} href={`#/${t.id}`} aria-current={current === t.id ? "page" : undefined}>
      <t.Icon size={22} strokeWidth={current === t.id ? 2.4 : 2} />{t.label}
      {t.id === "courses" && todo > 0 && <span className="badge">{todo > 99 ? "99+" : todo}</span>}
    </a>
  );
  return (
    <>
      <nav className="sidenav" aria-label="Navigation">
        <div className="brand"><img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" /><span>Stoemp</span></div>
        {TABS.slice(0, 4).map(link)}
        <div className="grow" />
        {admin}
        {link(TABS[4])}
      </nav>
      <nav className="tabbar" aria-label="Navigation">{TABS.map(link)}</nav>
    </>
  );
}
