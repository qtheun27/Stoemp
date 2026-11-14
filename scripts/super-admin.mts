// Donne (ou retire) l'accès à la console d'administration à un compte, sans écrire l'adresse dans le code.
// Usage : GOOGLE_APPLICATION_CREDENTIALS=… npx tsx scripts/super-admin.ts <e-mail> [--retirer]
// Le compte doit s'être connecté au moins une fois. La marque est active à la prochaine ouverture de l'appli.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const [email, flag] = process.argv.slice(2);
if (!email) { console.error("Indique l'adresse e-mail du compte."); process.exit(1); }
const u = await getAuth().getUserByEmail(email);
await getAuth().setCustomUserClaims(u.uid, { ...(u.customClaims || {}), superAdmin: flag !== "--retirer" });
console.log(flag === "--retirer" ? "Accès administrateur retiré." : `Accès administrateur donné à ${u.displayName || u.uid}.`);
