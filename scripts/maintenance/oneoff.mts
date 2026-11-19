// Tâche ponctuelle (workflow « Maintenance », oneoff) : diagnostic EN LECTURE SEULE.
// 1. Captures récentes hors Colruyt (structure seulement : les chiffres sont masqués, aucun prix n'apparaît dans le journal public).
// 2. Appels IA du capteur (extractPrices, matchProduct) des dernières 48 h : nombre, erreurs.
// 3. Photos : durée moyenne, refus de quota et cadence des dernières heures.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const mask = (s: string) => s.replace(/\d/g, "#");

const caps = (await db.collection("captures").orderBy("at", "desc").limit(30).get()).docs.map((d) => d.data());
console.log(`=== Captures récentes : ${caps.length} (${caps.filter((c) => c.store === "colruyt").length} Colruyt)`);
for (const c of caps.filter((x) => x.store !== "colruyt").slice(0, 6)) {
  const t = String(c.text || "");
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  const euro = lines.findIndex((l) => /€/.test(l));
  console.log(`\n--- ${c.store} · ${new Date(c.at).toISOString()} · ${mask(String(c.url).replace(/^https?:\/\/[^/]+/, ""))} · ${t.length} car., ${lines.length} lignes, ${(t.match(/€/g) || []).length} « € », ${(t.match(/\/\s?kg/gi) || []).length} « /kg »`);
  if (euro >= 0) console.log("Autour du 1er prix :\n  " + lines.slice(Math.max(0, euro - 6), euro + 10).map(mask).join("\n  "));
  else console.log("Aucun « € » dans le texte. Début :\n  " + lines.slice(0, 25).map(mask).join("\n  "));
}

const since = Date.now() - 48 * 3600_000;
const logs = (await db.collection("aiLogs").where("at", ">=", since).get()).docs.map((d) => d.data());
for (const task of ["extractPrices", "matchProduct", "classifyItem"]) {
  const l = logs.filter((x) => x.task === task);
  const errs = l.filter((x) => x.error).map((x) => String(x.error).slice(0, 120));
  console.log(`\n=== ${task} (48 h) : ${l.length} appels, ${errs.length} erreurs${errs.length ? " — " + [...new Set(errs)].slice(0, 4).join(" | ") : ""}`);
}

const img = logs.filter((x) => x.task === "dishImage");
const ok = img.filter((x) => !x.error), ko = img.filter((x) => x.error);
const avg = ok.length ? Math.round(ok.reduce((s, x) => s + (x.ms || 0), 0) / ok.length / 100) / 10 : 0;
console.log(`\n=== Photos (48 h) : ${ok.length} réussies (durée moyenne ${avg} s), ${ko.length} refus/erreurs`);
const byErr = new Map<string, number>();
for (const x of ko) { const k = String(x.error).slice(0, 80); byErr.set(k, (byErr.get(k) || 0) + 1); }
for (const [k, n] of [...byErr].sort((a, b) => b[1] - a[1]).slice(0, 5)) console.log(`  ${n} × ${k}`);
for (let h = 5; h >= 0; h--) {
  const a = Date.now() - (h + 1) * 3600_000, b = Date.now() - h * 3600_000;
  console.log(`  il y a ${h + 1}-${h} h : ${ok.filter((x) => x.at >= a && x.at < b).length} photos, ${ko.filter((x) => x.at >= a && x.at < b).length} refus`);
}
