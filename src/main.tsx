import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { StoreProvider } from "./state/store";
import { toast } from "./ui";
import { applyTheme } from "./views/Settings";
import "./styles.css";

// Appli installée sur l'écran d'accueil d'un iPhone : au lancement, iOS calcule parfois un écran trop court
// (de la hauteur de la barre d'état), et la barre du bas flotte trop haut. On se cale sur la vraie hauteur de l'écran.
function fitHeight() {
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const land = innerWidth > innerHeight;
  const sh = land ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height);
  const sw = land ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  // Seulement en plein écran (pas en écran partagé sur iPad) et pour un écart de la taille d'une barre d'état.
  const h = ios && Math.abs(innerWidth - sw) < 2 && sh > innerHeight && sh - innerHeight <= 80 ? sh : innerHeight;
  document.documentElement.style.setProperty("--app-h", `${h}px`);
}
fitHeight();
addEventListener("resize", fitHeight);
addEventListener("orientationchange", () => setTimeout(fitHeight, 300));
document.addEventListener("visibilitychange", () => setTimeout(fitHeight, 100));

try { const t = localStorage.getItem("stoemp-theme"); if (t === "light" || t === "dark") applyTheme(t); } catch { /* ignoré */ }

// Mises à jour automatiques : la nouvelle version s'installe en arrière-plan et prend la main aussitôt.
registerSW({
  immediate: true,
  onOfflineReady() { toast("Prête à fonctionner hors ligne"); },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider><App /></StoreProvider>
  </StrictMode>,
);
