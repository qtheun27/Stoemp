import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { StoreProvider } from "./state/store";
import { toast } from "./ui";
import { applyTheme } from "./views/Settings";
import "./styles.css";

// Hauteur réelle de la fenêtre de l'appli (barre d'état pleine : l'appli commence sous l'heure, elle est donc plus courte que l'écran).
// L'ancien calage sur la hauteur de l'écran poussait la barre du bas trop bas sur iPhone (menu coupé) : on prend la vraie hauteur.
function fitHeight() {
  const h = innerHeight;
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
