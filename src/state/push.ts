// Rappels sur ce téléphone : inscription aux notifications push (Firebase Cloud Messaging).
// Le téléphone est enregistré dans `users/{uid}/devices/{id}` avec son jeton, le foyer et les rappels choisis ;
// les Cloud Functions `remindMorning` / `remindDinner` envoient les rappels à heure fixe (heure belge).
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { app, db } from "../firebase";

export type Reminders = { courses: boolean; peremption: boolean; soir: boolean };
export const DEFAULT_REMINDERS: Reminders = { courses: true, peremption: true, soir: true };
const KEY = "stoemp-push-device";

/** Où en est ce téléphone : non pris en charge, iPhone à installer d'abord, refusé, ou prêt. */
export function pushSupport(): "ok" | "ios-install" | "unsupported" | "denied" {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return "ios-install";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "ok";
}

export const deviceId = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

/** Rappels déjà choisis sur ce téléphone (null = pas inscrit). */
export async function loadDevice(uid: string): Promise<{ id: string; reminders: Reminders; hid: string } | null> {
  const id = deviceId();
  if (!id) return null;
  const d = await getDoc(doc(db, "users", uid, "devices", id)).catch(() => null);
  if (!d?.exists()) return null;
  return { id, reminders: { ...DEFAULT_REMINDERS, ...(d.get("reminders") || {}) }, hid: d.get("hid") };
}

/** Demande l'autorisation, récupère le jeton du téléphone et l'enregistre (à appeler sur un toucher : règle des navigateurs). */
export async function enablePush(uid: string, hid: string, vapidKey: string, reminders: Reminders = DEFAULT_REMINDERS) {
  if (!vapidKey) throw new Error("Les rappels ne sont pas encore configurés (clé push Web manquante dans la console).");
  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) throw new Error("Ce navigateur ne reçoit pas les notifications.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notifications refusées : autorise-les pour Stoemp dans les réglages du téléphone.");
  const reg = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: reg });
  if (!token) throw new Error("Le téléphone n'a pas donné d'identifiant de notification : réessaie.");
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const id = [...new Uint8Array(bytes)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
  await setDoc(doc(db, "users", uid, "devices", id), { token, hid, reminders, ua: navigator.userAgent.slice(0, 160), updatedAt: Date.now() }, { merge: true });
  try { localStorage.setItem(KEY, id); } catch { /* ignoré */ }
  return id;
}

/** Change les rappels choisis, ou le foyer suivi, sur ce téléphone. */
export const updateDevice = (uid: string, id: string, patch: { reminders?: Reminders; hid?: string }) =>
  setDoc(doc(db, "users", uid, "devices", id), { ...patch, updatedAt: Date.now() }, { merge: true });

/** Plus aucun rappel sur ce téléphone. */
export async function disablePush(uid: string) {
  const id = deviceId();
  if (id) await deleteDoc(doc(db, "users", uid, "devices", id)).catch(() => {});
  try { const { getMessaging, deleteToken } = await import("firebase/messaging"); await deleteToken(getMessaging(app)); } catch { /* ignoré */ }
  try { localStorage.removeItem(KEY); } catch { /* ignoré */ }
}

/** Notification d'essai, montrée tout de suite par ce téléphone (sans passer par le serveur). */
export async function testNotification() {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification("🛒 Rappels Stoemp activés", { body: "Tu recevras ici le jour des courses, les produits qui périment et le repas du soir.", icon: "icons/icon-192.png", tag: "test" });
}
