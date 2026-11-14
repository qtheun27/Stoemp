import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { norm } from "../../lib/text";
import { useStore } from "../../state/store";
import { run, toast } from "../../ui";
import { adminCleanAnonymous, adminListUsers, adminUpdateUser, dt, type AdminUser } from "./api";

export default function Users() {
  const s = useStore();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [q, setQ] = useState("");
  const [f, setF] = useState<"all" | "google" | "demo" | "disabled" | "admin">("all");
  const [armed, setArmed] = useState<string | null>(null);
  const load = async () => { const r = await run(() => adminListUsers({})); if (r) setUsers(r.users.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))); };
  useEffect(() => { load(); }, []);
  const hhName = (id: string) => s.households.find((h) => h.id === id)?.name;
  const shown = useMemo(() => (users || []).filter((u) =>
    (f === "all" || (f === "google" && !u.anonymous) || (f === "demo" && u.anonymous) || (f === "disabled" && u.disabled) || (f === "admin" && u.superAdmin)) &&
    (!q || norm(`${u.email} ${u.name} ${u.uid}`).includes(norm(q)))), [users, q, f]);
  const act = async (u: AdminUser, action: Parameters<typeof adminUpdateUser>[0]["action"], ok: string) => {
    if (action === "delete" && armed !== u.uid) { setArmed(u.uid); toast("Touche encore « Supprimer » pour confirmer"); return; }
    setArmed(null);
    if (await run(() => adminUpdateUser({ uid: u.uid, action }), ok)) load();
  };
  return <div className="stack">
    <div className="row wrap">
      <input className="input grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (nom, e-mail, identifiant)" style={{ minWidth: 200 }} />
      <button className="btn soft" onClick={load}><RefreshCw size={16} />Actualiser</button>
    </div>
    <div className="chips">{([["all", "Tous"], ["google", "Google"], ["demo", "Démo"], ["disabled", "Suspendus"], ["admin", "Admins"]] as const).map(([k, l]) => <button key={k} className="chip" aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>)}</div>
    {!users ? <div className="empty">Chargement…</div> : <div className="list">{shown.map((u) => <div key={u.uid} className="li" style={{ flexWrap: "wrap" }}>
      <span className="avatar">{u.photo ? <img src={u.photo} alt="" referrerPolicy="no-referrer" /> : (u.name || u.email || "?")[0].toUpperCase()}</span>
      <div className="main-t">
        <span className="name">{u.name || (u.anonymous ? "Compte démo" : u.email)} {u.superAdmin && <span className="tag ac">admin appli</span>} {u.disabled && <span className="tag bad">suspendu</span>}</span>
        <span className="meta"><span>{u.email || u.uid.slice(0, 10)}</span><span>créé {dt(u.createdAt)}</span><span>vu {dt(u.lastSeen)}</span>
          {u.households.map((h) => <span key={h} className="tag">{hhName(h) || h.slice(0, 6)}</span>)}</span>
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        {u.uid !== s.user?.uid && <>
          <button className="btn soft sm" onClick={() => act(u, u.disabled ? "enable" : "disable", u.disabled ? "Compte réactivé" : "Compte suspendu")}>{u.disabled ? "Réactiver" : "Suspendre"}</button>
          {!u.anonymous && <button className="btn soft sm" onClick={() => act(u, u.superAdmin ? "removeSuper" : "makeSuper", "Droits mis à jour")}>{u.superAdmin ? "Retirer admin" : "Rendre admin"}</button>}
          <button className="btn danger sm" onClick={() => act(u, "delete", "Compte supprimé")}>{armed === u.uid ? "Confirmer" : "Supprimer"}</button>
        </>}
      </div>
    </div>)}</div>}
    <div className="card"><h3>Ménage</h3><p>Supprime les comptes démo inactifs et leurs foyers (quand ils en sont le seul membre).</p>
      <div className="row wrap">{[7, 30, 90].map((d) => <button key={d} className="btn ghost sm" onClick={async () => { const r = await run(() => adminCleanAnonymous({ days: d })); if (r) { toast(`${r.removed} compte(s) démo supprimé(s)`); load(); } }}>Inactifs depuis {d} j</button>)}</div>
    </div>
  </div>;
}
