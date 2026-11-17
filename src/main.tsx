import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { StoreProvider } from "./state/store";
import { toast } from "./ui";
import { applyTheme } from "./views/Settings";
import "./styles.css";

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
