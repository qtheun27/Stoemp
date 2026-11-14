import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { StoreProvider } from "./state/store";
import { toast } from "./ui";
import { applyTheme } from "./views/Settings";
import "./styles.css";

try { const t = localStorage.getItem("stoemp-theme"); if (t === "light" || t === "dark") applyTheme(t); } catch { /* ignoré */ }

// Mise à jour en douceur : nouvelle version installée en arrière-plan, appliquée au prochain lancement ou sur demande.
const update = registerSW({
  onNeedRefresh() { toast("Nouvelle version disponible : elle s'appliquera au prochain lancement"); setTimeout(() => update(true), 60_000); },
  onOfflineReady() { toast("Prête à fonctionner hors ligne"); },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider><App /></StoreProvider>
  </StrictMode>,
);
