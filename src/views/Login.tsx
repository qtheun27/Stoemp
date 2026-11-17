import { useEffect, useState } from "react";
import { GoogleAuthProvider, getRedirectResult, signInAnonymously, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { auth, onFirebaseHosting } from "../firebase";
import { toast } from "../ui";
import { useStore } from "../state/store";

export async function googleSignIn() {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  // Sur notre domaine (même domaine que la connexion), redirection dans la même page :
  // fiable sur iPhone et Android, dans le navigateur comme dans l'appli installée.
  if (onFirebaseHosting) return signInWithRedirect(auth, p);
  // Ailleurs (GitHub Pages) : fenêtre surgissante, puis redirection si elle est bloquée.
  try { await signInWithPopup(auth, p); }
  catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") await signInWithRedirect(auth, p);
    else if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") throw Object.assign(new Error("Connexion annulée"), { code: "annulee" });
    else throw e;
  }
}

export default function Login() {
  const { app } = useStore();
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState(() => { try { return sessionStorage.getItem("stoemp-login") === "1"; } catch { return false; } });
  useEffect(() => {
    getRedirectResult(auth)
      .then((r) => { if (!r && returning) toast("La connexion n'a pas abouti. Réessaie, ou ouvre le lien dans Safari."); })
      .catch((e) => toast(msg(e)))
      .finally(() => { setReturning(false); try { sessionStorage.removeItem("stoemp-login"); } catch { /* ignoré */ } });
  }, []);
  const msg = (e: unknown) => {
    const c = (e as { code?: string }).code || "";
    if (c.includes("operation-not-allowed") || c.includes("configuration-not-found")) return "Ce mode de connexion n'est pas encore activé dans Firebase.";
    if (c.includes("unauthorized-domain")) return "Ce domaine n'est pas autorisé dans Firebase Authentication.";
    if (c.includes("network")) return "Pas de connexion internet.";
    if (c === "annulee") return "Connexion annulée.";
    if (c.includes("web-storage-unsupported")) return "Ton navigateur bloque la connexion (navigation privée ?). Ouvre le lien dans Safari ou Chrome normal.";
    return "Connexion impossible : " + c;
  };
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); } catch (e) { toast(msg(e)); } finally { setBusy(false); } };
  return (
    <div className="login">
      <div className="box">
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" />
        <h1>Stoemp</h1>
        <p className="muted">Les repas de saison de la semaine, la liste de courses avec les vrais prix, le stock de la maison et ce qu'il faudra racheter.</p>
        <div className="stack" style={{ marginTop: 28 }}>
          {returning && <p className="muted">Connexion en cours…</p>}
          <button className="btn block" disabled={busy || returning} onClick={() => act(async () => { try { sessionStorage.setItem("stoemp-login", "1"); } catch { /* ignoré */ } await googleSignIn(); })}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            Continuer avec Google
          </button>
          {app.features.demo && <button className="btn ghost block" disabled={busy} onClick={() => act(() => signInAnonymously(auth))}>Essayer sans compte (démo)</button>}
        </div>
        {app.features.demo && <p className="muted small" style={{ marginTop: 20 }}>En mode démo, tes données restent liées à cet appareil. Tu pourras relier ton compte Google ensuite.</p>}
      </div>
    </div>
  );
}
