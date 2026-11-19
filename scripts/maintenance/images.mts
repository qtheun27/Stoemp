// Génère les photos des plats qui n'en ont pas encore (workflow « Maintenance », tâche images, nombre dans COUNT).
// TEST=1 : 5 plats variés choisis à la main pour juger la qualité avant de tout générer.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { IMAGE_COST, makeDishImage } from "../../functions/src/images";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const count = Math.max(1, Math.min(1500, Number(process.env.COUNT) || 5));
const TEST = ["base-carbonnade-flamande", "base-moules-frites", "lib-tarte-au-sucre", "lib-curry-vert-thai-au-poulet", "lib-soupe-aux-tomates-et-boulettes"];

const names = new Map((await db.collection("items").select("name").get()).docs.map((d) => [d.id, d.get("name") as string]));
const done = new Set((await db.collection("dishThumbs").select().get()).docs.map((d) => d.id));
let todo = (await db.collection("recipes").where("householdId", "==", null).get()).docs
  .filter((d) => !d.get("deleted") && d.get("source") !== "pret" && !done.has(d.id));
if (process.env.TEST === "1") todo = TEST.map((id) => todo.find((d) => d.id === id)).filter((d): d is NonNullable<typeof d> => !!d);
// Plats principaux d'abord (ceux que le planificateur propose), puis le reste.
todo.sort((a, b) => Number((a.get("course") || "plat") !== "plat") - Number((b.get("course") || "plat") !== "plat"));
todo = todo.slice(0, count);
console.log(`${todo.length} photo(s) à générer (${done.size} déjà faites), environ ${(todo.length * IMAGE_COST).toFixed(2)} $.`);

let ok = 0, fail = 0, i = 0;
const worker = async () => { for (; i < todo.length;) { const d = todo[i++];
  try { const s = await makeDishImage(d.id, d.data() as never, (id) => names.get(id), db); ok++; console.log(`✓ ${d.get("name")} (${Math.round(s.thumb / 1024)} Ko / ${Math.round(s.full / 1024)} Ko)`); }
  catch (e) { fail++; console.log(`✗ ${d.get("name")} : ${String((e as Error).message || e).slice(0, 200)}`); if (fail >= 5 && !ok) { console.log("Trop d'échecs, arrêt."); i = todo.length; } } } };
await Promise.all([worker(), worker(), worker()]);
console.log(`Terminé : ${ok} photo(s), ${fail} échec(s), environ ${(ok * IMAGE_COST).toFixed(2)} $.`);
