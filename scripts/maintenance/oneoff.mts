// Tâche ponctuelle (workflow « Maintenance », oneoff) : EN LECTURE SEULE, journaux de la file d'attente des produits inconnus
// (onEnrichJob) et des envois (extractPrices) depuis 14 h 00 (UTC 13 h 00). Messages tronqués, chiffres masqués.
import { execSync } from "node:child_process";
const mask = (s: string) => s.replace(/\d+[.,]\d{2}/g, "#,##").slice(0, 300);
for (const fn of ["onenrichjob", "extractprices"]) {
  const filter = `resource.type="cloud_run_revision" AND resource.labels.service_name="${fn}" AND timestamp>="2026-11-20T13:00:00Z" AND (severity>=WARNING OR textPayload:"classés" OR jsonPayload.message:"classés")`;
  try {
    const out = execSync(`gcloud logging read '${filter}' --project stoemp-app --limit 40 --format=json`, { encoding: "utf8", maxBuffer: 20e6 });
    const rows = JSON.parse(out) as { timestamp: string; severity: string; textPayload?: string; jsonPayload?: Record<string, unknown> }[];
    console.log(`\n=== ${fn} : ${rows.length} entrées`);
    for (const r of rows.reverse()) console.log(`${r.timestamp.slice(11, 19)} ${r.severity} ${mask(r.textPayload || JSON.stringify(r.jsonPayload))}`);
  } catch (e) { console.log(`=== ${fn} : lecture impossible — ${(e as Error).message.slice(0, 300)}`); }
}
