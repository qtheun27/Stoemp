// Tâche ponctuelle (workflow « Maintenance », oneoff) : liste EN LECTURE SEULE des tâches planifiées (Cloud Scheduler) des rappels.
import { GoogleAuth } from "google-auth-library";
const client = await new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] }).getClient();
try {
  const r = await client.request<{ jobs?: { name: string; schedule: string; timeZone: string; state: string; lastAttemptTime?: string }[] }>({ url: "https://cloudscheduler.googleapis.com/v1/projects/stoemp-app/locations/europe-west1/jobs" });
  const jobs = r.data.jobs || [];
  console.log(`${jobs.length} tâche(s) planifiée(s) :`);
  for (const j of jobs) console.log(`  ${j.name.split("/").pop()} · ${j.schedule} (${j.timeZone}) · ${j.state}`);
} catch (e) { console.log("Lecture impossible :", String((e as Error).message).slice(0, 200)); }
