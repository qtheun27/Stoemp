// Tâche ponctuelle (workflow « Maintenance », oneoff) : articles qui avaient atteint l'ancienne limite de 30 produits,
// puis relecture de la dernière page Carrefour depuis sa copie (`captureReplays` → onCaptureReplay) pour tout garder.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const full = new Map<string, number>();
for (const d of (await db.collection("prices").select("store", "offers").get()).docs) if ((d.get("offers") || []).length >= 30) full.set(d.get("store"), (full.get(d.get("store")) || 0) + 1);
console.log("Articles qui avaient atteint la limite de 30 produits :", [...full].map(([s, n]) => `${s} ${n}`).join(", ") || "aucun");
const caps = (await db.collection("captures").orderBy("at", "desc").limit(30).select("store", "at", "length", "url").get()).docs;
console.log("Copies de pages gardées :"); caps.forEach((c) => console.log(`  ${c.get("store")} · ${new Date(c.get("at")).toISOString()} · ${c.get("length")} car.`));
// Une relecture par page (la plus récente de chaque adresse), l'une après l'autre (jamais deux en même temps).
const seen = new Set<string>();
const todo = caps.filter((c) => { const k = `${c.get("store")}|${c.get("url")}`; if (seen.has(k)) return false; seen.add(k); return true; }).reverse();
for (const c of todo) {
  const ref = await db.collection("captureReplays").add({ captureId: c.id, at: Date.now() });
  let line = "pas de réponse en 9 min";
  for (let i = 0; i < 54; i++) {
    await new Promise((r) => setTimeout(r, 10_000));
    const r = (await ref.get()).data()!;
    if (r.doneAt || r.error) { line = r.error ? `erreur : ${r.error}` : `${r.found} produits lus, ${r.saved} articles avec prix, ${r.created} nouveaux articles, ${r.queued} en file d'attente`; break; }
  }
  console.log(`Relecture ${c.get("store")} (${new Date(c.get("at")).toISOString().slice(0, 16)}) : ${line}`);
}
