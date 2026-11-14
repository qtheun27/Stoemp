import type { Unit } from "./types";
import { norm } from "./text";

const UNITS = "(kg|g|gr|grammes?|ml|cl|dl|l|litres?|pc|pi[eè]ces?|tranches?|bo[iî]tes?|paquets?|bouteilles?|sachets?|rouleaux|c\\.? ?à ?s\\.?|cs|cuill[eè]res? à soupe|c\\.? ?à ?c\\.?|cc|cuill[eè]res? à caf[eé])";

export interface ParsedLine { name: string; qty: number; unit: Unit | "cs" | "cc" | ""; }

/** « 2 l de lait », « 400 g de pâtes », « lait 2l », « 3 citrons » → nom, quantité, unité métrique. */
export function parseLine(input: string): ParsedLine | null {
  const l = input.trim().replace(/^[-•*]\s*/, "");
  if (!l) return null;
  let q = "", u = "", n: string;
  let m = l.match(new RegExp("^([\\d.,/½]+)\\s*" + UNITS + "?\\.?\\s+(?:de |d'|d’)?(.+)$", "i"));
  if (m) { q = m[1]; u = m[2] || ""; n = m[3]; }
  else {
    m = l.match(new RegExp("^(.+?)\\s*:?\\s+([\\d.,/½]+)\\s*" + UNITS + "?\\.?$", "i"));
    if (m) { n = m[1]; q = m[2]; u = m[3] || ""; } else n = l;
  }
  let num = 0;
  if (q) {
    const qq = q.replace("½", ".5").replace(",", ".");
    num = qq.includes("/") ? Number(qq.split("/")[0]) / Number(qq.split("/")[1]) : parseFloat(qq);
    if (!isFinite(num)) num = 0;
  }
  const uu = norm(u);
  let unit: ParsedLine["unit"] = "";
  if (num) {
    if (uu === "kg") { unit = "g"; num *= 1000; }
    else if (/^g/.test(uu)) unit = "g";
    else if (uu === "l" || uu.startsWith("litre")) { unit = "ml"; num *= 1000; }
    else if (uu === "cl") { unit = "ml"; num *= 10; }
    else if (uu === "dl") { unit = "ml"; num *= 100; }
    else if (uu === "ml") unit = "ml";
    else if (uu.startsWith("c") && /s\.?$|soupe/.test(uu)) unit = "cs";
    else if (uu.startsWith("c") && uu !== "cl") unit = "cc";
    else unit = "pc";
  }
  n = n.replace(/:/g, " ").trim();
  n = n.charAt(0).toUpperCase() + n.slice(1);
  return { name: n, qty: num, unit };
}
