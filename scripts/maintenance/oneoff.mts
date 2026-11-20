// Tâche ponctuelle (workflow « Maintenance », oneoff) : vérification EN LECTURE SEULE des services Google nécessaires aux rappels.
import { GoogleAuth } from "google-auth-library";
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const client = await auth.getClient();
for (const api of ["cloudscheduler.googleapis.com", "fcm.googleapis.com", "fcmregistrations.googleapis.com", "firebaseinstallations.googleapis.com", "pubsub.googleapis.com", "cloudfunctions.googleapis.com", "run.googleapis.com"]) {
  try {
    const r = await client.request<{ state?: string }>({ url: `https://serviceusage.googleapis.com/v1/projects/stoemp-app/services/${api}` });
    console.log(`${api} : ${r.data.state}`);
  } catch (e) { console.log(`${api} : lecture impossible (${String((e as Error).message).slice(0, 120)})`); }
}
