import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// BASE : "/Stoemp/" sur GitHub Pages, "/" sur Firebase Hosting.
const base = process.env.BASE || "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png", "icons/*.svg", "splash/*.png"],
      manifest: {
        id: "stoemp",
        name: "Stoemp — repas, courses et stock",
        short_name: "Stoemp",
        description: "Repas de saison, liste de courses avec les vrais prix, stock et rachats prévus.",
        lang: "fr-BE",
        start_url: ".",
        scope: ".",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone"],
        orientation: "any",
        background_color: "#f3f5ef",
        theme_color: "#4f8a2e",
        categories: ["food", "lifestyle", "shopping"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Liste de courses", short_name: "Courses", url: "./#/courses", icons: [{ src: "icons/icon-192.png", sizes: "192x192" }] },
          { name: "Semaine", short_name: "Semaine", url: "./#/semaine", icons: [{ src: "icons/icon-192.png", sizes: "192x192" }] },
          { name: "Stock", short_name: "Stock", url: "./#/stock", icons: [{ src: "icons/icon-192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        globIgnores: ["splash/**"],
        navigateFallback: "index.html",
        // Ne jamais intercepter les pages techniques de Firebase (connexion Google : /__/auth/handler).
        navigateFallbackDenylist: [/^\/__\//, /\/__\/auth\//],
        // La nouvelle version prend la main tout de suite (corrige les anciennes versions installées).
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: { rollupOptions: { output: { manualChunks: { firebase: ["firebase/app", "firebase/auth", "firebase/firestore", "firebase/functions"], react: ["react", "react-dom"] } } } },
  test: { include: ["src/**/*.test.ts"] },
});
