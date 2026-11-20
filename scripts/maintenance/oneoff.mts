// Tâche ponctuelle (workflow « Maintenance », oneoff) : LECTURE SEULE. Échantillon des produits retirés par la relecture
// (journaux d'onReviewJob) et bilan « retirés / replacés » par passe. Aucun prix affiché.
import { execSync } from "node:child_process";
const read = (filter: string, n: number) => JSON.parse(execSync(`gcloud logging read '${filter}' --project stoemp-app --limit ${n} --format=json`, { encoding: "utf8", maxBuffer: 50e6 })) as { timestamp: string; jsonPayload?: Record<string, unknown> }[];
const base = `resource.type="cloud_run_revision" AND resource.labels.service_name="onreviewjob" AND timestamp>="2026-11-20T16:40:00Z"`;
for (const r of read(`${base} AND jsonPayload.message="Relecture"`, 20)) console.log(`Passe ${r.jsonPayload?.magasin} : ${r.jsonPayload?.articles} articles, ${r.jsonPayload?.retirés} retirés, ${r.jsonPayload?.replacés} replacés`);
const rows = read(`${base} AND jsonPayload.message="Relecture : produits retirés"`, 1000);
console.log(`\n${rows.length} articles corrigés. Échantillon (article ← produits retirés) :`);
for (let i = 0; i < rows.length; i += Math.max(1, Math.floor(rows.length / 70))) {
  const p = rows[i].jsonPayload || {};
  console.log(`  ${p.article} ← ${((p.produits as string[]) || []).slice(0, 4).join(" | ")}`);
}
