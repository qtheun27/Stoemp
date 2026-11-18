// Reconstruit le carnet de prix compact lu par l'appli (priceBook).
// Usage : GOOGLE_APPLICATION_CREDENTIALS=… npx tsx scripts/rebuild-pricebook.mts   (ou workflow « Maintenance »)
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { rebuildPriceBook } from "../functions/src/pricebook";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
console.log(`${await rebuildPriceBook(undefined, getFirestore() as never)} fiches de prix compactées dans le carnet.`);
