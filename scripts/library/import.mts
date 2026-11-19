// Envoie les recettes écrites à la main (scripts/library/*.txt) dans la bibliothèque, puis reconstruit les fiches compactes « library/{cuisine}-{n} ».
// Idempotent : une recette déjà envoyée est mise à jour (et reste masquée si elle l'a été) ; un plat déjà présent sous un autre nom est ignoré.
// Usage : workflow « Maintenance » → library (ou GOOGLE_APPLICATION_CREDENTIALS=… npx tsx scripts/library/import.mts [--dry])
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { BASE_INDEX } from "../../src/lib/catalog";
import { loadLibrary, sameDish, type LibIng } from "./format";

const dry = process.argv.includes("--dry");
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const clean = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
const LIB_CHUNK = 400;

async function main() {
  const { recipes, errors } = loadLibrary();
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }

  // 1. Articles : chaque ingrédient doit exister en base avec la même unité.
  const used = [...new Set(recipes.flatMap((r) => [...r.ingredients, ...r.meat, ...r.vegSwap].map((i) => i.itemId)))];
  const snaps = await db.getAll(...used.map((id) => db.collection("items").doc(id)));
  const bad: string[] = [], missing: string[] = [];
  for (const s of snaps) {
    const base = BASE_INDEX.get(s.id)!;
    if (!s.exists) missing.push(s.id);
    else if (s.get("unit") !== base.unit) bad.push(`${base.name} : ${s.get("unit")} en base, ${base.unit} dans le catalogue`);
  }
  if (bad.length) { console.error("Unités différentes :\n" + bad.join("\n")); process.exit(1); }

  // 2. Recettes déjà en base : la nôtre est mise à jour, un même plat sous un autre nom est laissé tel quel.
  const existing = (await db.collection("recipes").where("lib", "==", true).get()).docs;
  const byId = new Map(existing.map((d) => [d.id, d]));
  const others = existing.filter((d) => !d.get("deleted"));
  let b = db.batch(), n = 0, added = 0, updated = 0;
  const flush = async () => { if (n && !dry) await b.commit(); b = db.batch(); n = 0; };
  for (const id of missing) { const { id: _id, ...it } = BASE_INDEX.get(id)!; b.set(db.collection("items").doc(id), clean(it)); n++; }
  const skipped: string[] = [];
  // Versions détaillées des plats de base : la photo déjà générée suit, puis l'ancienne fiche est masquée.
  let replaced = 0;
  for (const r of recipes.filter((x) => x.replaces)) {
    for (const col of ["dishThumbs", "dishImages"]) {
      const [from, to] = await db.getAll(db.collection(col).doc(r.replaces!), db.collection(col).doc(r.id));
      if (from.exists && !to.exists && !dry) await db.collection(col).doc(r.id).set(from.data()!);
    }
    b.set(db.collection("recipes").doc(r.replaces!), { deleted: true }, { merge: true }); n++; replaced++;
  }
  for (const r of recipes) {
    const twin = others.find((d) => d.id !== r.id && d.id !== r.replaces && (d.get("course") || "plat") === r.course && sameDish(d.get("name"), r.name));
    if (twin && !byId.has(r.id)) { skipped.push(`${r.name} (déjà là : ${twin.get("name")})`); continue; }
    const prev = byId.get(r.id);
    const doc = {
      name: r.name, vegName: r.vegName, prepMin: r.prepMin, seasons: r.seasons, ingredients: r.ingredients, meat: r.meat, vegSwap: r.vegSwap, steps: r.steps,
      cuisine: r.cuisine, course: r.course, servings: r.servings, ...(r.light ? { light: true } : {}), sideLabel: r.sideLabel || null, source: "base", lib: true, householdId: null,
      deleted: prev ? !!prev.get("deleted") : false, createdAt: prev?.get("createdAt") || Date.now(), author: "chef",
    };
    b.set(db.collection("recipes").doc(r.id), clean(doc));
    if (prev) updated++; else added++;
    if (++n >= 400) await flush();
  }
  await flush();

  // 3. Fiches compactes reconstruites d'un bloc (recettes masquées exclues).
  const all = dry ? [] : (await db.collection("recipes").where("lib", "==", true).get()).docs.filter((d) => !d.get("deleted"));
  const t = (l: LibIng[] = []) => l.map((x) => (x.spoon ? [x.itemId, x.qtyPerPerson, x.spoon] : [x.itemId, x.qtyPerPerson]));
  const byCuisine = new Map<string, unknown[]>();
  for (const d of all.sort((a, z) => (a.get("createdAt") || 0) - (z.get("createdAt") || 0))) {
    const r = d.data(), c = r.cuisine as string;
    if (!byCuisine.has(c)) byCuisine.set(c, []);
    byCuisine.get(c)!.push({ i: d.id, n: r.name, v: r.vegName ?? null, t: r.prepMin, s: (r.seasons || []).join(""), c, k: r.course || "plat", ...(r.light ? { lt: 1 } : {}), ...(r.sideLabel ? { sd: r.sideLabel } : {}),
      g: t(r.ingredients), m: t(r.meat), w: t(r.vegSwap) });
  }
  const chunks = new Map<string, unknown[]>();
  for (const [c, list] of byCuisine) for (let i = 0; i < list.length; i += LIB_CHUNK) chunks.set(`${c}-${i / LIB_CHUNK}`, list.slice(i, i + LIB_CHUNK));
  if (!dry) {
    const old = (await db.collection("library").select().get()).docs.map((d) => d.id);
    for (const [k, r] of chunks) { b.set(db.collection("library").doc(k), { cuisine: k.replace(/-\d+$/, ""), r: clean(r) }); if (++n >= 400) await flush(); }
    for (const id of old) if (!chunks.has(id)) { b.delete(db.collection("library").doc(id)); n++; }
    await flush();
  }
  if (skipped.length) console.log(`Déjà présents, ignorés (${skipped.length}) :\n  ${skipped.join("\n  ")}`);
  console.log(`${dry ? "[essai] " : ""}${recipes.length} recettes écrites à la main : ${added} ajoutées, ${updated} mises à jour, ${skipped.length} ignorées, ${replaced} plats de base remplacés ; ${missing.length} articles créés.`);
  if (!dry) console.log(`Bibliothèque : ${all.length} recettes dans ${chunks.size} fiches compactes.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
