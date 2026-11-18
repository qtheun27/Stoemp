import { memo, type ReactNode } from "react";
import { artSpec, type ArtSpec, type Protein, type Starch, type Veg } from "../lib/dishart";
import type { ItemIndex } from "../lib/catalog";
import type { Cuisine, Recipe } from "../lib/types";

/** Fond légèrement teinté selon la cuisine (nappe). */
const TABLE: Record<Cuisine, string> = {
  belge: "#f3e3c3", francaise: "#e8eef7", italienne: "#f6e2dc", mediterraneenne: "#dfeef0", orientale: "#f4e0c8",
  asiatique: "#f3dede", indienne: "#f7e6c2", latino: "#e5f0d8", americaine: "#e3e8f2",
};

/** Générateur pseudo-aléatoire déterministe (même plat → même dessin). */
function rng(seed: number) { let a = seed || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
type R = () => number;
const around = (r: R, cx: number, cy: number, rx: number, ry: number, n: number) =>
  Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 + r() * 0.8; const d = 0.35 + r() * 0.65; return [cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, r()] as const; });

function starchArt(k: Starch, r: R, x: number, y: number): ReactNode {
  switch (k) {
    case "riz": return <g>{<ellipse cx={x} cy={y} rx={24} ry={15} fill="#fbf8f0" stroke="#e6dcc5" />}{around(r, x, y, 21, 12, 38).map(([a, b, t], i) => <ellipse key={i} cx={a} cy={b} rx={2.6} ry={1.2} transform={`rotate(${t * 180} ${a} ${b})`} fill="#fff" stroke="#e3d8bf" strokeWidth={0.5} />)}</g>;
    case "pates": case "nouilles": { const c = k === "pates" ? "#f0c35a" : "#efd48d", w = k === "pates" ? 3.6 : 2.2;
      return <g fill="none" stroke={c} strokeWidth={w} strokeLinecap="round">{Array.from({ length: 9 }, (_, i) => { const yy = y - 12 + i * 3; return <path key={i} d={`M${x - 22 + r() * 4} ${yy} q8 ${-6 + r() * 4} 15 0 t15 0 t14 ${r() * 3}`} />; })}</g>; }
    case "frites": return <g>{Array.from({ length: 10 }, (_, i) => { const a = x - 20 + i * 4.4, b = y - 8 + r() * 10, rot = -35 + r() * 70; return <rect key={i} x={a} y={b} width={5} height={24} rx={1.5} fill="#f2b84b" stroke="#d6922b" strokeWidth={0.8} transform={`rotate(${rot} ${a + 2} ${b + 12})`} />; })}</g>;
    case "puree": return <g><ellipse cx={x} cy={y} rx={24} ry={15} fill="#f6e5b2" stroke="#e2c98a" /><path d={`M${x - 14} ${y} q7 -8 14 -2 t14 -1`} stroke="#e6cd8c" strokeWidth={2} fill="none" /><rect x={x - 4} y={y - 9} width={8} height={6} rx={1.5} fill="#f9dc65" /></g>;
    case "pdt": return <g>{[[-12, -4], [5, -7], [-4, 7], [13, 5], [-17, 8]].map(([a, b], i) => <g key={i}><ellipse cx={x + a} cy={y + b} rx={9} ry={7} fill="#e8c260" stroke="#c99d3f" /><ellipse cx={x + a - 3} cy={y + b - 2} rx={3} ry={1.5} fill="#f5dc8e" /></g>)}</g>;
    case "semoule": case "polenta": return k === "polenta"
      ? <g><rect x={x - 18} y={y - 10} width={34} height={20} rx={4} fill="#f2c94c" stroke="#d4a72c" /><path d={`M${x - 14} ${y - 4}h26M${x - 14} ${y + 3}h26`} stroke="#e0b23a" /></g>
      : <g><ellipse cx={x} cy={y} rx={24} ry={14} fill="#efd48a" stroke="#d8b863" />{around(r, x, y, 20, 11, 30).map(([a, b], i) => <circle key={i} cx={a} cy={b} r={0.9} fill="#d9b25a" />)}</g>;
    case "pain": return <g>{[[-8, -2, -12], [8, 3, 10]].map(([a, b, rot], i) => <g key={i} transform={`rotate(${rot} ${x + a} ${y + b})`}><rect x={x + a - 13} y={y + b - 10} width={26} height={20} rx={7} fill="#b9773b" /><rect x={x + a - 10} y={y + b - 7} width={20} height={14} rx={5} fill="#f1d7a2" /></g>)}</g>;
    case "gnocchi": return <g>{around(r, x, y, 18, 10, 12).map(([a, b, t], i) => <g key={i}><ellipse cx={a} cy={b} rx={5} ry={3.6} fill="#f3dea0" stroke="#d9be72" transform={`rotate(${t * 90} ${a} ${b})`} /></g>)}</g>;
  }
}

function proteinArt(k: Protein, r: R, x: number, y: number, name: string): ReactNode {
  switch (k) {
    case "viande": return <g>{[[-10, -4], [8, -6], [-2, 7], [14, 6]].map(([a, b], i) => <g key={i}><path d={`M${x + a - 9} ${y + b} q2 -8 10 -7 q9 1 8 8 q-1 7 -9 7 q-8 0 -9 -8z`} fill="#7a3a22" /><path d={`M${x + a - 4} ${y + b - 2} q4 -3 8 0`} stroke="#a65a3a" strokeWidth={2} fill="none" /></g>)}</g>;
    case "volaille": return <g>{[[-8, -2, -15], [10, 4, 20]].map(([a, b, rot], i) => <g key={i} transform={`rotate(${rot} ${x + a} ${y + b})`}><ellipse cx={x + a} cy={y + b} rx={15} ry={9} fill="#d9953f" stroke="#b46d28" /><path d={`M${x + a - 9} ${y + b - 3}l18 0M${x + a - 9} ${y + b + 2}l18 0`} stroke="#9c5a20" strokeWidth={1.6} /></g>)}</g>;
    case "poisson": { const salmon = /saumon|truite/.test(name); const c = salmon ? "#f39b74" : "#f4e4d1", line = salmon ? "#fbd0b8" : "#e2c8a8";
      return <g><path d={`M${x - 24} ${y + 2} q10 -16 32 -12 q14 3 16 10 q-4 9 -18 11 q-20 3 -30 -9z`} fill={c} stroke={salmon ? "#d9775a" : "#d8b98f"} />{[0, 1, 2, 3].map((i) => <path key={i} d={`M${x - 14 + i * 9} ${y - 7} q3 6 0 13`} stroke={line} strokeWidth={1.4} fill="none" />)}</g>; }
    case "crevettes": return <g fill="none" stroke="#ef8648" strokeWidth={5} strokeLinecap="round">{around(r, x, y, 16, 9, 6).map(([a, b, t], i) => <path key={i} d={`M${a - 5} ${b - 3} a6 6 0 1 0 8 2`} transform={`rotate(${t * 360} ${a} ${b})`} />)}</g>;
    case "moules": return <g>{around(r, x, y, 18, 10, 7).map(([a, b, t], i) => <g key={i} transform={`rotate(${t * 180} ${a} ${b})`}><ellipse cx={a} cy={b} rx={8} ry={4.5} fill="#2c2f3d" /><ellipse cx={a + 1} cy={b} rx={5} ry={2.6} fill="#f2a24c" /></g>)}</g>;
    case "saucisse": return <g>{[[-4, -5, -8], [4, 6, 6]].map(([a, b, rot], i) => <g key={i} transform={`rotate(${rot} ${x + a} ${y + b})`}><rect x={x + a - 20} y={y + b - 5} width={40} height={11} rx={5.5} fill="#9a4a2b" /><path d={`M${x + a - 10} ${y + b - 4}l4 9M${x + a} ${y + b - 4}l4 9M${x + a + 10} ${y + b - 4}l4 9`} stroke="#6e2f19" strokeWidth={1.4} /></g>)}</g>;
    case "charcuterie": return <g>{around(r, x, y, 16, 9, 9).map(([a, b], i) => <rect key={i} x={a - 3.5} y={b - 3} width={7} height={6} rx={1.5} fill="#e38f86" stroke="#c46a63" strokeWidth={0.6} />)}</g>;
    case "oeuf": return <g>{[[-8, -2], [10, 4]].map(([a, b], i) => <g key={i}><path d={`M${x + a - 13} ${y + b} q-1 -11 11 -11 q13 -1 13 9 q0 11 -12 10 q-11 1 -12 -8z`} fill="#fffdf6" stroke="#ece4d3" /><circle cx={x + a} cy={y + b} r={5} fill="#f5b12c" /><circle cx={x + a - 1.5} cy={y + b - 1.5} r={1.4} fill="#fbd87a" /></g>)}</g>;
    case "tofu": return <g>{around(r, x, y, 15, 8, 6).map(([a, b], i) => <g key={i}><rect x={a - 6} y={b - 6} width={12} height={12} rx={2} fill="#f2e6c7" stroke="#d8b66d" strokeWidth={1.4} /></g>)}</g>;
    case "legumineuses": return <g>{around(r, x, y, 20, 12, 34).map(([a, b, t], i) => <circle key={i} cx={a} cy={b} r={2.6} fill={/rouges|noirs/.test(name) ? (t > 0.5 ? "#7a2b23" : "#5a2019") : t > 0.5 ? "#c08a4a" : "#e2c48f"} stroke="#00000020" strokeWidth={0.4} />)}</g>;
    case "fromage": return <g>{[[-8, -3], [8, 4]].map(([a, b], i) => <g key={i}><rect x={x + a - 12} y={y + b - 7} width={24} height={14} rx={3} fill="#f4e3a8" stroke="#d8c06b" /><path d={`M${x + a - 7} ${y + b - 6}l6 12M${x + a + 1} ${y + b - 6}l6 12`} stroke="#c49a3a" strokeWidth={1.3} /></g>)}</g>;
  }
}

function vegArt(k: Veg, r: R, x: number, y: number): ReactNode {
  const pts = around(r, x, y, 14, 7, 5);
  const dots = (fill: string, rad: number, inner?: string) => pts.map(([a, b], i) => <g key={i}><circle cx={a} cy={b} r={rad} fill={fill} />{inner && <circle cx={a} cy={b} r={rad * 0.5} fill={inner} />}</g>);
  switch (k) {
    case "carotte": return dots("#f08a2e", 4.2, "#f6b066");
    case "tomate": return <g>{pts.map(([a, b], i) => <g key={i}><circle cx={a} cy={b} r={4.6} fill="#e2402f" /><circle cx={a - 1.4} cy={b - 1.4} r={1.2} fill="#f6a39a" /></g>)}</g>;
    case "courgette": return dots("#5f9e43", 4.2, "#dfeab0");
    case "concombre": return dots("#4f8a3a", 4.2, "#d6ebb0");
    case "radis": return dots("#d9406a", 3.8, "#fff");
    case "pois": return <g>{around(r, x, y, 14, 7, 12).map(([a, b], i) => <circle key={i} cx={a} cy={b} r={2.4} fill="#7cbd48" stroke="#5c9a33" strokeWidth={0.5} />)}</g>;
    case "mais": return <g>{around(r, x, y, 14, 7, 12).map(([a, b], i) => <rect key={i} x={a - 1.8} y={b - 1.8} width={3.6} height={3.6} rx={1} fill="#f4cf3b" />)}</g>;
    case "brocoli": return <g>{pts.slice(0, 3).map(([a, b], i) => <g key={i}><rect x={a - 1.5} y={b} width={3} height={6} fill="#9cc66a" /><circle cx={a - 3} cy={b - 1} r={3.6} fill="#3f8a3a" /><circle cx={a + 3} cy={b - 1} r={3.6} fill="#3f8a3a" /><circle cx={a} cy={b - 4} r={3.8} fill="#4a9a43" /></g>)}</g>;
    case "champignon": return <g>{pts.slice(0, 4).map(([a, b], i) => <g key={i}><rect x={a - 2} y={b - 1} width={4} height={5} rx={1} fill="#efe2c8" /><path d={`M${a - 6} ${b} q6 -9 12 0z`} fill="#b98c62" /></g>)}</g>;
    case "poivron": return <g>{pts.map(([a, b, t], i) => <rect key={i} x={a - 7} y={b - 1.8} width={14} height={3.6} rx={1.8} fill={i % 2 ? "#e2472f" : "#f3b13a"} transform={`rotate(${t * 180} ${a} ${b})`} />)}</g>;
    case "aubergine": return <g>{pts.slice(0, 4).map(([a, b], i) => <g key={i}><path d={`M${a - 5} ${b} a5 5 0 0 1 10 0z`} fill="#5b2a5f" /><path d={`M${a - 3.6} ${b} a3.6 3.6 0 0 1 7.2 0z`} fill="#efe3c0" /></g>)}</g>;
    case "haricot": return <g stroke="#4f9a3a" strokeWidth={2.6} strokeLinecap="round">{pts.map(([a, b, t], i) => <path key={i} d={`M${a - 8} ${b} l16 ${-4 + t * 8}`} />)}</g>;
    case "oignon": return <g fill="none" stroke="#e8d6ea" strokeWidth={1.8}>{pts.slice(0, 4).map(([a, b], i) => <circle key={i} cx={a} cy={b} r={4} />)}</g>;
    case "avocat": return <g>{pts.slice(0, 3).map(([a, b, t], i) => <path key={i} d={`M${a - 7} ${b} q7 -9 14 0 q-7 5 -14 0z`} fill="#a7cc63" stroke="#4e7a2a" strokeWidth={1.2} transform={`rotate(${t * 60 - 30} ${a} ${b})`} />)}</g>;
    case "courge": return <g>{pts.map(([a, b], i) => <rect key={i} x={a - 3.4} y={b - 3.4} width={6.8} height={6.8} rx={1.4} fill="#f29a3a" stroke="#d27a22" strokeWidth={0.6} />)}</g>;
    case "betterave": return <g>{pts.map(([a, b], i) => <rect key={i} x={a - 3.4} y={b - 3.4} width={6.8} height={6.8} rx={1.4} fill="#8b1e3f" />)}</g>;
    case "epinard": case "salade": case "chou": { const c = k === "epinard" ? "#2f6b2f" : k === "chou" ? "#b9d68a" : "#86bf4f";
      return <g>{pts.map(([a, b, t], i) => <path key={i} d={`M${a - 7} ${b} q7 -8 14 0 q-7 6 -14 0z`} fill={c} stroke="#00000018" transform={`rotate(${t * 180} ${a} ${b})`} />)}</g>; }
    case "asperge": return <g>{pts.slice(0, 4).map(([a, b, t], i) => <g key={i} transform={`rotate(${-20 + t * 40} ${a} ${b})`}><rect x={a - 1.8} y={b - 10} width={3.6} height={20} rx={1.8} fill="#6aa84f" /><path d={`M${a - 2.5} ${b - 9} l2.5 -4 2.5 4z`} fill="#4c8a35" /></g>)}</g>;
  }
}

function garnishArt(s: ArtSpec, r: R, cx: number, cy: number): ReactNode {
  return <g>
    {s.garnish.includes("herbes") && around(r, cx, cy, 44, 26, 14).map(([a, b, t], i) => <ellipse key={`h${i}`} cx={a} cy={b} rx={2} ry={1.1} fill="#3f9a3a" transform={`rotate(${t * 180} ${a} ${b})`} />)}
    {s.garnish.includes("fromage") && around(r, cx, cy, 30, 18, 12).map(([a, b, t], i) => <rect key={`f${i}`} x={a} y={b} width={5} height={1.4} rx={0.7} fill="#f6e29a" transform={`rotate(${t * 180} ${a} ${b})`} />)}
    {s.garnish.includes("sesame") && around(r, cx, cy, 30, 18, 16).map(([a, b], i) => <ellipse key={`s${i}`} cx={a} cy={b} rx={1.1} ry={0.6} fill="#fbf3dd" />)}
    {s.garnish.includes("citron") && <g><path d={`M${cx + 40} ${cy + 16} a10 10 0 0 1 18 -6z`} fill="#f6d64a" stroke="#d9b52c" /><path d={`M${cx + 43} ${cy + 13} l10 -5`} stroke="#fbe99a" /></g>}
  </g>;
}

/** Desserts et pâtisseries : coupe, verrine, part, tarte, biscuits, pile de crêpes. */
function sweetArt(s: ArtSpec, r: R): ReactNode {
  const c = s.color, cream = "#fbf4e2";
  switch (s.vessel) {
    case "cup": return <g><path d="M62 70 h76 q-4 30 -38 32 q-34 -2 -38 -32z" fill="#ffffffcc" stroke="#d9d4cc" /><rect x={97} y={100} width={6} height={22} fill="#e2ddd4" /><ellipse cx={100} cy={124} rx={22} ry={5} fill="#e2ddd4" />
      <circle cx={84} cy={64} r={15} fill={c} /><circle cx={112} cy={62} r={15} fill={cream} /><circle cx={99} cy={50} r={14} fill={c === cream ? "#5b3424" : c} opacity={0.92} />
      <path d="M78 58 q8 6 14 0 q6 8 14 0 q6 6 12 0" stroke="#5b3424" strokeWidth={2.4} fill="none" opacity={0.7} /></g>;
    case "glass": return <g><rect x={70} y={38} width={60} height={82} rx={10} fill="#ffffff99" stroke="#d6d0c6" strokeWidth={2} />
      <rect x={73} y={92} width={54} height={25} rx={6} fill="#c99a5e" /><rect x={73} y={66} width={54} height={28} fill={c} /><path d="M73 66 q9 -10 18 -2 q9 -9 18 0 q9 -8 18 2v2H73z" fill={cream} />
      {around(r, 100, 56, 16, 4, 6).map(([a, b], i) => <circle key={i} cx={a} cy={b} r={1.8} fill={c} opacity={0.8} />)}</g>;
    case "slice": return <g><path d="M48 104 L132 70 L156 92 L72 128z" fill="#e8bd7a" /><path d="M48 104 L132 70 L132 60 L48 92z" fill={c} /><path d="M48 92 L132 60 L156 80 L72 114z" fill={c} opacity={0.9} />
      <path d="M48 104 L72 128 L156 92" fill="none" stroke="#b98a4a" /><path d="M58 100 L140 66" stroke={cream} strokeWidth={3} opacity={0.7} /></g>;
    case "tart": return <g><ellipse cx={100} cy={84} rx={62} ry={42} fill="#d79b52" stroke="#b9793a" strokeWidth={2} /><ellipse cx={100} cy={82} rx={52} ry={34} fill={c} />
      {around(r, 100, 82, 40, 24, 10).map(([a, b], i) => <circle key={i} cx={a} cy={b} r={5} fill={c} stroke="#00000022" />)}
      {Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; return <circle key={i} cx={100 + Math.cos(a) * 57} cy={84 + Math.sin(a) * 38} r={3} fill="#e3ad66" />; })}</g>;
    case "cookies": return <g><ellipse cx={100} cy={86} rx={78} ry={50} fill="#fbfaf7" stroke="#e3ddd2" />{around(r, 100, 84, 48, 28, 6).map(([a, b, t], i) =>
      <g key={i}><circle cx={a} cy={b} r={13} fill={t > 0.5 ? "#e2b26a" : c} stroke="#b9853f" strokeWidth={1.2} />{around(r, a, b, 8, 8, 4).map(([p, q], j) => <circle key={j} cx={p} cy={q} r={1.4} fill="#7a4a26" opacity={0.7} />)}</g>)}</g>;
    case "stack": return <g><ellipse cx={100} cy={96} rx={78} ry={44} fill="#fbfaf7" stroke="#e3ddd2" />{[0, 1, 2, 3].map((i) =>
      <ellipse key={i} cx={100} cy={96 - i * 8} rx={50} ry={22} fill={i % 2 ? "#e8b766" : "#f0c97c"} stroke="#c99545" />)}
      <path d="M70 66 q30 -12 60 0 q-4 18 -10 20 q-4 -8 -8 0 q-12 6 -24 0 q-4 -6 -8 2 q-8 -6 -10 -22z" fill={c} opacity={0.85} /></g>;
    case "waffle": return <g><ellipse cx={100} cy={92} rx={80} ry={46} fill="#fbfaf7" stroke="#e3ddd2" />
      {[[-26, -4, -8], [20, 6, 10]].map(([a, b, rot], k) => <g key={k} transform={`rotate(${rot} ${100 + a} ${84 + b})`}>
        <rect x={100 + a - 30} y={84 + b - 20} width={60} height={40} rx={8} fill="#e2a64e" stroke="#b97a2c" strokeWidth={1.5} />
        {[1, 2, 3, 4].map((i) => <path key={`v${i}`} d={`M${100 + a - 30 + i * 12} ${84 + b - 18}v36`} stroke="#b97a2c" strokeWidth={2} />)}
        {[1, 2].map((i) => <path key={`h${i}`} d={`M${100 + a - 28} ${84 + b - 20 + i * 13.3}h56`} stroke="#b97a2c" strokeWidth={2} />)}
        {around(r, 100 + a, 84 + b, 22, 14, 6).map(([p, q], j) => <circle key={j} cx={p} cy={q} r={1.8} fill="#fff6dc" />)}</g>)}</g>;
    default: return null;
  }
}

function DishArtSvg({ recipe, idx, height = 140, rounded = 14 }: { recipe: Recipe; idx: ItemIndex; height?: number | string; rounded?: number }) {
  const s = artSpec(recipe, idx);
  const r = rng(s.seed);
  const bg = recipe.cuisine ? TABLE[recipe.cuisine] : "#efe9df";
  const sweet = ["cup", "glass", "slice", "tart", "cookies", "stack", "waffle"].includes(s.vessel);
  const name = recipe.name.toLowerCase() + " " + recipe.meat.map((i) => idx.get(i.itemId)?.name.toLowerCase()).join(" ");
  return <svg viewBox="0 0 200 150" role="img" aria-label={`Illustration : ${recipe.name}`} style={{ width: "100%", height, display: "block", borderRadius: rounded, background: bg }}>
    <ellipse cx={100} cy={134} rx={80} ry={10} fill="#00000014" />
    {sweet ? sweetArt(s, r)
      : s.vessel === "mug" ? <g><rect x={66} y={50} width={62} height={70} rx={12} fill="#fffaf2" stroke="#d9cfc0" strokeWidth={2} /><path d="M128 66 q20 0 20 18 q0 18 -20 18" fill="none" stroke="#d9cfc0" strokeWidth={6} />
        <ellipse cx={97} cy={56} rx={28} ry={6} fill={s.color} />{[80, 97, 114].map((x, i) => <path key={i} d={`M${x} 42 q-6 -8 0 -16 q6 -8 0 -16`} stroke="#ffffffcc" strokeWidth={2.4} fill="none" />)}</g>
      : s.vessel === "bowl" ? <g><path d="M30 66 q70 90 140 0z" fill="#fffdf8" stroke="#ddd5c7" strokeWidth={2} /><ellipse cx={100} cy={66} rx={70} ry={17} fill="#fffdf8" stroke="#ddd5c7" strokeWidth={2} />
        <ellipse cx={100} cy={67} rx={62} ry={13} fill={s.color} />
        {s.starch && ["pates", "nouilles"].includes(s.starch) && <path d="M60 66 q10 -6 20 0 t20 0 t20 0 t20 0" stroke="#f3dc95" strokeWidth={2.4} fill="none" />}
        {s.protein && ["oeuf"].includes(s.protein) && <g><ellipse cx={86} cy={66} rx={9} ry={5} fill="#fff" /><circle cx={86} cy={66} r={3} fill="#f5b12c" /></g>}
        {s.sauce === "#f1e3c4" && <path d="M78 66 q14 -8 26 0 q10 6 20 -2" stroke="#fffaf0" strokeWidth={3} fill="none" opacity={0.9} />}
        {s.starch === "pain" && around(r, 100, 66, 40, 7, 5).map(([a, b], i) => <rect key={i} x={a - 3} y={b - 3} width={6} height={6} rx={1.2} fill="#d8a256" />)}
        {s.veg.length > 0 && around(r, 100, 66, 44, 8, 6).map(([a, b], i) => <circle key={i} cx={a} cy={b} r={2.4} fill={["#f08a2e", "#7cbd48", "#e2402f"][i % 3]} opacity={0.8} />)}
        {around(r, 100, 66, 46, 8, 10).map(([a, b, t], i) => <ellipse key={`g${i}`} cx={a} cy={b} rx={2} ry={1.1} fill="#3f9a3a" transform={`rotate(${t * 180} ${a} ${b})`} />)}</g>
      : s.vessel === "board" ? <g><rect x={22} y={50} width={156} height={72} rx={14} fill="#c8955c" stroke="#a87542" strokeWidth={2} /><rect x={150} y={78} width={34} height={12} rx={6} fill="#c8955c" stroke="#a87542" strokeWidth={2} />
        {/houmous|tzatziki|guacamole|tapenade|baba|ganoush|mouhammara|tirokafteri|dip|labneh|melitzano|pico/.test(recipe.name.toLowerCase())
          ? <g><ellipse cx={78} cy={86} rx={30} ry={18} fill="#fffdf8" stroke="#ddd5c7" /><ellipse cx={78} cy={86} rx={24} ry={13} fill={s.sauce || s.color} />
            {Array.from({ length: 5 }, (_, i) => <path key={i} d={`M${118 + i * 9} 70 l8 24 l-14 0z`} fill="#e7bf7a" stroke="#c99545" />)}</g>
          : <g>{around(r, 92, 86, 60, 24, 9).map(([a, b, t], i) => <g key={i}><circle cx={a} cy={b} r={9} fill={t > 0.66 ? "#e7b25a" : t > 0.33 ? "#d9953f" : "#f0cf86"} stroke="#b9853f" />
            {s.veg[0] && <circle cx={a + 2} cy={b - 2} r={3} fill={{ tomate: "#e2402f", poivron: "#e2472f", avocat: "#a7cc63" }[s.veg[0] as string] || "#7cbd48"} />}</g>)}</g>}</g>
      : <g><ellipse cx={100} cy={82} rx={84} ry={56} fill="#fbfaf7" stroke="#e1dbcf" strokeWidth={2} /><ellipse cx={100} cy={82} rx={66} ry={42} fill="#f4f1ea" />
        {s.sauce && <path d={`M${92} ${70} q30 -14 40 6 q8 18 -18 22 q-26 4 -30 -10 q-2 -12 8 -18z`} fill={s.sauce} opacity={0.92} />}
        {s.starch && starchArt(s.starch, r, s.protein ? 72 : 100, s.protein ? 80 : 78)}
        {s.protein && proteinArt(s.protein, r, s.starch ? 120 : 100, 76, name)}
        {(s.starch || s.protein ? s.veg.slice(0, 3).map((v, i) => [v, [100, 70, 132][i], [104, 102, 100][i]] as const)
          // Plat de légumes seul : les légumes occupent toute l'assiette.
          : s.veg.flatMap((v, i) => [[v, 78 + (i % 3) * 22, 72 + (i % 2) * 10], [v, 92 + (i % 3) * 18, 92 - (i % 2) * 8]] as const))
          .map(([v, x, y], i) => <g key={`${v}${i}`}>{vegArt(v, r, x, y)}</g>)}
        {!s.starch && !s.protein && !s.veg.length && <ellipse cx={100} cy={80} rx={34} ry={20} fill={s.color} />}
        {garnishArt(s, r, 100, 82)}</g>}
  </svg>;
}

/** Illustration vectorielle d'un plat, dessinée d'après sa recette (contenant, féculent, protéine, légumes, sauce). */
export const DishArt = memo(DishArtSvg, (a, b) => a.recipe.id === b.recipe.id && a.recipe.name === b.recipe.name && a.height === b.height);
