// Tâche ponctuelle (workflow « Maintenance », oneoff) : affiche les articles créés en base hors du catalogue de départ
// (au format de catalog-raw.ts) et les noms de la bibliothèque, pour écrire de nouvelles recettes sans doublon.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { BASE_ITEMS } from "../../src/lib/catalog";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const base = new Set(BASE_ITEMS.map((i) => i.id));
const items = (await db.collection("items").get()).docs.filter((d) => !base.has(d.id));
console.log(`ARTICLES HORS CATALOGUE (${items.length}) :`);
for (const d of items) { const i = d.data();
  const flags = (i.local ? "L" : "") + (i.organicAvailable ? "B" : "") + (i.perishable ? "P" : "");
  console.log(`${i.name}|${i.category}|${i.unit}|${i.packSize}|${i.demoPrice ?? 1.99}|${flags}|${i.shelfLifeDays || ""}|${(i.allergens || []).join(",")}|${(i.aliases || []).join(",")}|`); }
const lib = (await db.collection("recipes").where("lib", "==", true).get()).docs.filter((d) => !d.get("deleted"));
const by = new Map<string, string[]>();
for (const d of lib) { const k = `${d.get("cuisine")}/${d.get("course") || "plat"}`; by.set(k, [...(by.get(k) || []), d.get("name")]); }
console.log(`\nBIBLIOTHÈQUE (${lib.length}) :`);
for (const [k, v] of [...by].sort()) console.log(`${k} : ${v.join(" | ")}`);
