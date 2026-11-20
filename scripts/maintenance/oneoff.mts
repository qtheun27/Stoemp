// Tâche ponctuelle (workflow « Maintenance », oneoff) : EN LECTURE SEULE, contrôle du dernier envoi Carrefour.
// Aucun prix affiché (journal public) : seulement les noms, l'article relié et la cohérence de la contenance.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
for (const d of (await db.collection("enrichJobs").get()).docs) console.log(`File d'attente : ${d.get("store")} · ${d.get("pos")}/${(d.get("products") || []).length}${d.get("paused") ? ` · en pause (${d.get("paused")})` : ""}`);
const since = new Date(Date.now() - 3 * 3600_000).toISOString();
const prices = (await db.collection("prices").where("store", "==", "carrefour").get()).docs.map((d) => d.data()).filter((p) => String(p.fetchedAt) >= since);
console.log(`Fiches de prix Carrefour (3 h) : ${prices.length}`);
const names = new Map((await db.collection("items").select("name").get()).docs.map((d) => [d.id, d.get("name") as string]));
// Contenance écrite dans le nom (« 6 x 1,5 L », « 33cl », « 500 g ») comparée à celle enregistrée.
const sizeIn = (n: string) => {
  const m = n.match(/(?:(\d+)\s?[x×]\s?)?(\d+(?:[.,]\d+)?)\s?(kg|g|gr|l|cl|ml)\b/i);
  if (!m) return null;
  const v = Number(m[2].replace(",", ".")) * (m[1] ? Number(m[1]) : 1), u = m[3].toLowerCase();
  return u === "kg" ? v * 1000 : u === "l" ? v * 1000 : u === "cl" ? v * 10 : v;
};
let ok = 0, ko = 0, none = 0; const bad: string[] = [];
for (const p of prices) for (const o of (p.offers || []) as { name: string; size: number; seenAt: string }[]) {
  if (o.seenAt < since) continue;
  const s = sizeIn(o.name);
  if (!s) { none++; continue; }
  if (Math.abs(s - o.size) <= s * 0.25) ok++; else { ko++; if (bad.length < 12) bad.push(`${o.name} → ${names.get(p.itemId)} (contenance ${o.size} au lieu de ${s})`); }
}
console.log(`Contenance cohérente avec le nom : ${ok} · incohérente : ${ko} · sans contenance dans le nom : ${none}`);
bad.forEach((b) => console.log("  ✗ " + b));
console.log("\nÉchantillon (produit → article) :");
prices.slice(0, 25).forEach((p) => console.log(`  ${p.productName} → ${names.get(p.itemId) || p.itemId}`));
