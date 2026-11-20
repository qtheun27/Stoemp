import { useRef, useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";

// ---------- Toast ----------
type Listener = (m: string) => void;
const listeners = new Set<Listener>();
export const toast = (m: string) => listeners.forEach((l) => l(m));
export function Toasts() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const l: Listener = (m) => { setMsg(m); clearTimeout(t); t = setTimeout(() => setMsg(null), 2800); };
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

/** Exécute une action asynchrone et affiche l'erreur éventuelle. */
export async function run<T>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> {
  try { const r = await fn(); if (ok) toast(ok); return r; }
  catch (e) { toast((e as Error).message || "Une erreur est survenue"); return undefined; }
}

// ---------- Feuille ----------
export function Sheet({ title, sub, onClose, children, actions }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { removeEventListener("keydown", k); document.body.style.overflow = o; };
  }, [onClose]);
  // Glisser vers le bas pour fermer (quand la feuille est tout en haut), comme sur iOS et Android.
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; dy: number } | null>(null);
  const onStart = (e: React.TouchEvent) => { if ((ref.current?.scrollTop || 0) <= 0) drag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dy: 0 }; };
  const onMove = (e: React.TouchEvent) => {
    const d = drag.current, el = ref.current;
    if (!d || !el) return;
    // Geste horizontal (rangée de boutons qu'on fait défiler) : ce n'est pas une fermeture.
    if (!d.dy && Math.abs(e.touches[0].clientX - d.x) > Math.abs(e.touches[0].clientY - d.y)) { drag.current = null; return; }
    d.dy = Math.max(0, e.touches[0].clientY - d.y);
    if (d.dy > 0 && el.scrollTop <= 0) { el.style.transform = `translateY(${d.dy}px)`; el.style.transition = "none"; }
  };
  const onEnd = () => {
    const d = drag.current, el = ref.current;
    drag.current = null;
    if (!d || !el) return;
    el.style.transition = "transform .2s"; el.style.transform = "";
    if (d.dy > 110) onClose();
  };
  return (
    <div className="sheet-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" ref={ref} onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} onTouchCancel={onEnd}>
        <div className="grab" />
        <div className="sheet-head">
          <div className="grow"><h2>{title}</h2>{sub && <div className="muted small">{sub}</div>}</div>
          {actions}
          <button className="ib" onClick={onClose} aria-label="Fermer"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Petits contrôles ----------
export const Switch = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) =>
  <input type="checkbox" role="switch" className="sw" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />;

export const Check = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) =>
  <input type="checkbox" className="check" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />;

export function Stepper({ value, onChange, min = 1, max = 12, step = 1, fmt }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; fmt?: (v: number) => string }) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - step))} aria-label="Moins">−</button>
      <b>{fmt ? fmt(value) : value}</b>
      <button onClick={() => onChange(Math.min(max, value + step))} aria-label="Plus">+</button>
    </div>
  );
}

export function TopBar({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="topbar">
      <div className="topbar-in">
        <h1>{title}{sub && <span className="sub">{sub}</span>}</h1>
        {children}
      </div>
    </header>
  );
}

export const Empty = ({ icon, children }: { icon: string; children: ReactNode }) => <div className="empty"><div className="big">{icon}</div>{children}</div>;

/** Lecture d'un fichier image redimensionné (tickets) en base64 JPEG. */
export async function fileToJpegBase64(file: File, maxSide = 2000): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85).split(",")[1];
}

export async function copyText(t: string) {
  try { await navigator.clipboard.writeText(t); return true; }
  catch {
    const a = document.createElement("textarea"); a.value = t; document.body.appendChild(a); a.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch { /* ignoré */ } a.remove(); return ok;
  }
}
