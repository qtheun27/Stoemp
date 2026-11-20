// Tâche ponctuelle (workflow « Maintenance », oneoff) : EN LECTURE SEULE, dépense IA du mois par tâche et plafond fixé.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const cfg = (await db.collection("config").doc("ai").get()).data() || {};
console.log(`Plafond mensuel : ${cfg.monthlyBudgetUsd ?? "non fixé"} $`);
const start = new Date(2026, 10, 1).getTime();
const logs = (await db.collection("aiLogs").where("at", ">=", start).select("cost", "task", "at", "model").get()).docs.map((d) => d.data());
const by = new Map<string, { n: number; cost: number }>();
for (const l of logs) { const k = String(l.task); const v = by.get(k) || { n: 0, cost: 0 }; v.n++; v.cost += l.cost || 0; by.set(k, v); }
const total = logs.reduce((a, l) => a + (l.cost || 0), 0);
console.log(`Dépense du mois : ${total.toFixed(2)} $ en ${logs.length} appels`);
for (const [k, v] of [...by].sort((a, b) => b[1].cost - a[1].cost)) console.log(`  ${k.padEnd(16)} ${String(v.n).padStart(6)} appels  ${v.cost.toFixed(2).padStart(8)} $`);
const days = new Map<string, number>();
for (const l of logs) { const k = new Date(l.at).toISOString().slice(0, 10); days.set(k, (days.get(k) || 0) + (l.cost || 0)); }
console.log("Par jour :"); for (const [k, v] of [...days].sort()) console.log(`  ${k} ${v.toFixed(2)} $`);
