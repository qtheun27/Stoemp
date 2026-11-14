import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { createHousehold, joinHousehold } from "../state/actions";
import { run, toast } from "../ui";
import { useStore } from "../state/store";
import { seedDemo } from "./demo";

export default function Onboarding({ token }: { token?: string }) {
  const s = useStore();
  const [name, setName] = useState(auth.currentUser?.isAnonymous ? "Foyer démo" : "Notre foyer");
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    const id = await run(() => createHousehold(name.trim() || "Notre foyer", auth.currentUser?.isAnonymous, s.app.defaults));
    if (id && auth.currentUser?.isAnonymous) await run(() => seedDemo(id));
    setBusy(false);
  };
  const join = async () => {
    if (!token) return;
    setBusy(true);
    const r = await run(() => joinHousehold({ token, displayName: auth.currentUser?.displayName || undefined }));
    if (r) { toast(`Bienvenue dans « ${r.name} »`); location.hash = "/semaine"; }
    setBusy(false);
  };
  return (
    <div className="login">
      <div className="box">
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" />
        <h1>Bienvenue</h1>
        {token ? (
          <>
            <p className="muted">Tu as reçu une invitation à rejoindre un foyer.</p>
            <button className="btn block" disabled={busy} onClick={join}>Rejoindre le foyer</button>
          </>
        ) : (
          <>
            <p className="muted">Crée ton foyer : réglages, stock, semaines et courses seront partagés avec les personnes que tu invites.</p>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nom du foyer" style={{ margin: "18px 0 10px" }} />
            <button className="btn block" disabled={busy} onClick={create}>Créer le foyer</button>
            <p className="muted small" style={{ marginTop: 16 }}>Pour rejoindre un foyer existant, ouvre le lien d'invitation qu'on t'a envoyé.</p>
          </>
        )}
        <button className="btn soft sm" style={{ marginTop: 18 }} onClick={() => signOut(auth)}>Se déconnecter</button>
      </div>
    </div>
  );
}
