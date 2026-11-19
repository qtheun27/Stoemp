import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { ItemIndex } from "../lib/catalog";
import type { Recipe } from "../lib/types";
import { DishArt } from "./DishArt";

/** Photos déjà lues (cache mémoire ; Firestore garde aussi les documents hors ligne). */
const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();
function load(col: "dishThumbs" | "dishImages", id: string): Promise<string | null> {
  const k = `${col}/${id}`;
  if (cache.has(k)) return Promise.resolve(cache.get(k)!);
  if (!pending.has(k)) pending.set(k, getDoc(doc(db, col, id)).then((d) => { const v = (d.get("d") as string) || null; cache.set(k, v); return v; }).catch(() => null));
  return pending.get(k)!;
}

/** Photo du plat (générée à sa création), ou son illustration dessinée en attendant / hors ligne. */
export function DishImage({ recipe, idx, height, rounded = 14, thumb }: { recipe: Recipe; idx: ItemIndex; height: number; rounded?: number; thumb?: boolean }) {
  const col = thumb ? "dishThumbs" : "dishImages";
  const [src, setSrc] = useState<string | null>(cache.get(`${col}/${recipe.id}`) ?? null);
  useEffect(() => { let on = true; if (recipe.id) load(col, recipe.id).then((v) => on && setSrc(v)); return () => { on = false; }; }, [col, recipe.id]);
  if (!src) return <DishArt recipe={recipe} idx={idx} height={height} rounded={rounded} crop={thumb} />;
  return <img src={src} alt={recipe.name} loading="lazy" decoding="async" style={{ width: "100%", height, objectFit: "cover", display: "block", borderRadius: rounded }} />;
}
