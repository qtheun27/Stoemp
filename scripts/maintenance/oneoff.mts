// Tâche ponctuelle (workflow « Maintenance », oneoff) : ESSAI À BLANC (lecture seule). Produits relevés rangés sous un article
// avec lequel ils ne partagent aucun mot (nom de l'article seulement) : nombre par magasin et échantillon. Aucun prix affiché.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { sharesWord } from "../../functions/src/readers/match";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const names = new Map((await db.collection("items").select("name").get()).docs.map((d) => [d.id, d.get("name") as string]));
const by = new Map<string, number>(); const sample: string[] = []; let total = 0;
for (const p of (await db.collection("prices").select("itemId", "store", "offers").get()).docs) {
  const n = names.get(p.get("itemId")); if (!n) continue;
  for (const o of (p.get("offers") || []) as { name: string }[]) {
    total++;
    if (sharesWord(o.name, [n])) continue;
    by.set(p.get("store"), (by.get(p.get("store")) || 0) + 1);
    sample.push(`${o.name} → ${n}`);
  }
}
console.log(`Produits relevés : ${total} · sans mot commun avec leur article : ${[...by.values()].reduce((a, b) => a + b, 0)} (${[...by].map(([s, c]) => `${s} ${c}`).join(", ")})`);
for (let i = 0; i < sample.length; i += Math.max(1, Math.floor(sample.length / 80))) console.log("  " + sample[i]);
for (const d of (await db.collection("enrichJobs").get()).docs) console.log(`File ${d.get("store")} · ${d.get("pos")}/${(d.get("products") || []).length}`);
