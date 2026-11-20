// Tâche ponctuelle (workflow « Maintenance », oneoff) : EN LECTURE SEULE, bilan de la file Carrefour (aucun prix affiché).
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const jobs = (await db.collection("enrichJobs").get()).docs;
console.log(jobs.length ? jobs.map((d) => `File d'attente : ${d.get("store")} · ${d.get("pos")}/${(d.get("products") || []).length}${d.get("paused") ? ` · en pause (${d.get("paused")})` : ""}`).join("\n") : "File d'attente : vide (tout est classé)");
const since = new Date(Date.now() - 4 * 3600_000).toISOString();
const prices = (await db.collection("prices").where("store", "==", "carrefour").get()).docs.map((d) => d.data());
const fresh = prices.filter((p) => String(p.fetchedAt) >= since);
console.log(`Fiches de prix Carrefour : ${prices.length} (dont ${fresh.length} de cet envoi), ${fresh.reduce((a, p) => a + (p.offers || []).length, 0)} produits relevés`);
const sizeIn = (n: string) => {
  const m = n.match(/(?:(\d+)\s?[x×]\s?)?(\d+(?:[.,]\d+)?)\s?(kg|g|gr|l|cl|ml)\b/i);
  if (!m) return null;
  const v = Number(m[2].replace(",", ".")) * (m[1] ? Number(m[1]) : 1), u = m[3].toLowerCase();
  return u === "kg" || u === "l" ? v * 1000 : u === "cl" ? v * 10 : v;
};
let ok = 0, ko = 0;
for (const p of fresh) for (const o of (p.offers || []) as { name: string; size: number }[]) { const s = sizeIn(o.name); if (s) { if (Math.abs(s - o.size) <= s * 0.25) ok++; else ko++; } }
console.log(`Contenance cohérente avec le nom : ${ok} · incohérente : ${ko}`);
const created = await db.collection("items").where("category", "==", "bs").count().get();
console.log(`Articles du rayon Boissons : ${created.data().count}`);
