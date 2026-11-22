import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { StoreProvider } from "./state/store";
import { toast } from "./ui";
import { applyTheme } from "./views/Settings";
import "./styles.css";

// Hauteur de l'appli installée sur iPhone. Deux cas selon le téléphone :
//  · l'appli commence sous l'heure (barre d'état pleine, marge du haut nulle) : iOS donne la bonne hauteur → innerHeight ;
//  · l'appli passe sous l'heure (marge du haut > 0) : iOS annonce parfois une hauteur trop courte → hauteur de l'écran.
const probe = document.createElement("div");
probe.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;padding-top:env(safe-area-inset-top)";
document.documentElement.appendChild(probe);
function fitHeight() {
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const underStatusBar = parseFloat(getComputedStyle(probe).paddingTop) > 0;
  const land = innerWidth > innerHeight;
  const sh = land ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height);
  const h = ios && underStatusBar && !land && sh > innerHeight && sh - innerHeight <= 80 ? sh : innerHeight;
  document.documentElement.style.setProperty("--app-h", `${h}px`);
}
fitHeight();
// Au lancement, iOS (et certains Android) donnent la hauteur avant d'avoir fini de placer l'appli, puis la corrigent sans
// prévenir : on remesure pendant les premières secondes, et à chaque changement (retour dans l'appli, rotation, clavier).
[100, 300, 700, 1500, 3000].forEach((t) => setTimeout(fitHeight, t));
addEventListener("pageshow", () => setTimeout(fitHeight, 50));
addEventListener("focus", () => setTimeout(fitHeight, 50));
window.visualViewport?.addEventListener("resize", fitHeight);
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
