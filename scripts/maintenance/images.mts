// Génère les photos des plats qui n'en ont pas encore (workflow « Maintenance », tâche images, nombre dans COUNT).
// TEST=1 : 5 plats variés choisis à la main pour juger la qualité avant de tout générer.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { IMAGE_COST, makeDishImage } from "../../functions/src/images";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const count = Math.max(1, Math.min(300, Number(process.env.COUNT) || 5));
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

// Une photo à la fois, avec une pause : le quota de Vertex AI est compté à la minute. Un refus « quota » n'est pas facturé :
// on attend et on réessaie ; après 5 refus d'affilée, on s'arrête. Le nombre demandé est un plafond strict (≈ COUNT × 0,04 $).
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
let ok = 0, fail = 0, streak = 0;
for (const d of todo) {
  let done = false;
  for (let attempt = 0; attempt < 3 && !done; attempt++) {
    try { const s = await makeDishImage(d.id, d.data() as never, (id) => names.get(id), db); ok++; streak = 0; done = true; console.log(`✓ ${d.get("name")} (${Math.round(s.thumb / 1024)} Ko)`); }
    catch (e) {
      const msg = String((e as Error).message || e);
      if (!/exhausted|429|quota/i.test(msg)) { fail++; console.log(`✗ ${d.get("name")} : ${msg.slice(0, 200)}`); break; }
      if (++streak >= 5) { console.log("Quota épuisé 5 fois d'affilée : arrêt (rien n'est facturé pour les refus)."); break; }
      await pause(60_000 * (attempt + 1));
    }
  }
  if (streak >= 5) break;
  await pause(8_000);
}
console.log(`Terminé : ${ok} photo(s), ${fail} échec(s), environ ${(ok * IMAGE_COST).toFixed(2)} $.`);
