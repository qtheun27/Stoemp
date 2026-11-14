import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, initializeFirestore, memoryLocalCache, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

// Configuration web Firebase : publique par nature (la sécurité repose sur les règles Firestore).
const host = typeof location !== "undefined" ? location.hostname : "";
const onFirebaseHosting = /\.(web\.app|firebaseapp\.com)$/.test(host);

export const app = initializeApp({
  apiKey: "AIzaSyCsDYee9NACugZSH5U-YsIbyxAFuesennM",
  // Sur Firebase Hosting, même domaine que l'appli : la connexion par redirection fonctionne aussi dans la PWA iPhone.
  authDomain: onFirebaseHosting ? host : "stoemp-app.firebaseapp.com",
  projectId: "stoemp-app",
  storageBucket: "stoemp-app.firebasestorage.app",
  messagingSenderId: "187935869834",
  appId: "1:187935869834:web:1b9b84919069edc37ad673",
});

export const auth = getAuth(app);
const EMU = import.meta.env.VITE_EMULATORS === "1"; // tests locaux
export const db = initializeFirestore(app, { localCache: EMU ? memoryLocalCache() : persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
const functions = getFunctions(app, "europe-west1");
if (EMU) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
/** Appel d'une Cloud Function, avec des messages d'erreur lisibles. */
export const call = <I, O>(name: string) => async (data: I): Promise<O> => {
  try { return (await httpsCallable<I, O>(functions, name, { timeout: 300_000 })(data)).data; }
  catch (e) {
    const err = e as { code?: string; message?: string };
    const code = (err.code || "").replace("functions/", "");
    if (code === "internal" && (!err.message || err.message === "internal")) throw new Error("Service momentanément indisponible. Réessaie dans un instant.");
    if (code === "not-found" && err.message === "not-found") throw new Error("Fonction pas encore déployée.");
    if (code === "unavailable" || code === "deadline-exceeded") throw new Error("Pas de réponse du serveur : vérifie ta connexion.");
    throw new Error(err.message || "Une erreur est survenue");
  }
};
export { onFirebaseHosting };
