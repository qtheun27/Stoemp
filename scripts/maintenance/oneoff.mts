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
const last = caps.find((c) => c.get("store") === "carrefour");
if (last) {
  const ref = await db.collection("captureReplays").add({ captureId: last.id, at: Date.now() });
  console.log(`Relecture lancée pour la page Carrefour du ${new Date(last.get("at")).toISOString()}`);
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 10_000));
    const r = (await ref.get()).data()!;
    if (r.doneAt || r.error) { console.log(r.error ? `Erreur : ${r.error}` : `Relecture terminée : ${r.found} produits lus, ${r.saved} articles avec prix, ${r.created} nouveaux articles, ${r.queued} en file d'attente`); break; }
  }
}
