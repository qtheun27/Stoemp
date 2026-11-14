import { getFirestore, FieldValue } from "firebase-admin/firestore";
import type { z } from "zod";
import type { ClassifiedItem } from "./schemas";

export interface ItemDoc { id: string; name: string; aliases: string[]; category: string; unit: "g" | "ml" | "pc"; packSize: number; organicAvailable?: boolean }

export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/\s+/g, " ").trim();
export const slug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const key = (s: string) => norm(s).split(" ").map((w) => (w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w)).join(" ");

let cache: { at: number; items: ItemDoc[] } | null = null;

export async function loadItems(): Promise<ItemDoc[]> {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.items;
  const snap = await getFirestore().collection("items").get();
  cache = { at: Date.now(), items: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ItemDoc, "id">) })) };
  return cache.items;
}

export function findItem(items: ItemDoc[], name: string): ItemDoc | undefined {
  const k = key(name);
  return items.find((i) => [i.name, ...(i.aliases || [])].some((n) => key(n) === k));
}

/** Liste compacte du catalogue pour les prompts (identifiant, nom, unité). */
export const catalogPrompt = (items: ItemDoc[]) => items.map((i) => `${i.id} | ${i.name} | ${i.unit}`).join("\n");

export async function createItem(c: z.infer<typeof ClassifiedItem>, alias?: string): Promise<ItemDoc> {
  const items = await loadItems();
  const existing = findItem(items, c.name) || (alias ? findItem(items, alias) : undefined);
  if (existing) return existing;
  const id = slug(c.name) || "article";
  const doc = {
    name: c.name, aliases: alias && norm(alias) !== norm(c.name) ? [alias] : [], category: c.category, unit: c.unit,
    packSize: c.packSize > 0 ? c.packSize : 1, local: c.local, organicAvailable: c.organicAvailable, perishable: c.perishable,
    shelfLifeDays: c.shelfLifeDays, allergens: c.allergens, seasonMonths: c.seasonMonths, staple: false, common: false,
    demoPrice: 0, source: "ia", createdAt: FieldValue.serverTimestamp(),
  };
  await getFirestore().collection("items").doc(id).set(doc, { merge: true });
  const item = { id, ...doc } as unknown as ItemDoc;
  cache?.items.push(item);
  return item;
}
