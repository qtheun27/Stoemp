// Génère les photos des plats qui n'en ont pas encore (workflow « Maintenance », tâche images, nombre dans COUNT).
// TEST=1 : 5 plats variés choisis à la main pour juger la qualité avant de tout générer.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { IMAGE_COST, IMAGE_LOCATIONS, imagesThisMonth, makeDishImage } from "../../functions/src/images";
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
// Plafond du mois (photos facturées, créations automatiques comprises) : jamais de dérapage de coût.
const maxMonth = Number(process.env.PHOTOS_MAX_MOIS) || Infinity;
const left = Math.max(0, maxMonth - (await imagesThisMonth(db)));
todo = todo.slice(0, Math.min(count, left));
if (!todo.length) { console.log(left ? "Tous les plats ont leur photo : rien à faire." : `Plafond du mois atteint (${maxMonth} photos) : reprise le mois prochain.`); process.exit(0); }
console.log(`${todo.length} photo(s) à générer (${done.size} déjà faites), environ ${(todo.length * IMAGE_COST).toFixed(2)} $.`);

// Une photo à la fois. Refus « quota » (non facturé) : on passe tout de suite au point d'accès suivant (régions de Google) ;
// une région qui ne propose pas le modèle est retirée ; si toutes refusent d'affilée, courte pause puis on recommence.
// Après 30 refus d'affilée, arrêt. Le nombre demandé est un plafond strict (≈ COUNT × 0,04 $).
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const locs = [...IMAGE_LOCATIONS];
let ok = 0, fail = 0, streak = 0, li = 0;
const byLoc = new Map<string, number>();
for (const d of todo) {
  let done = false;
  for (let attempt = 0; attempt < locs.length * 3 && !done && locs.length; attempt++) {
    const loc = locs[li % locs.length];
    try {
      const s = await makeDishImage(d.id, d.data() as never, (id) => names.get(id), db, loc);
      ok++; streak = 0; done = true; byLoc.set(loc, (byLoc.get(loc) || 0) + 1);
      console.log(`✓ ${d.get("name")} (${Math.round(s.thumb / 1024)} Ko, ${loc})`);
    } catch (e) {
      const msg = String((e as Error).message || e);
      if (/not found|not supported|404|is not available|location/i.test(msg) && !/exhausted|429/i.test(msg)) { console.log(`Région ${loc} sans ce modèle : retirée.`); locs.splice(li % locs.length, 1); continue; }
      if (!/exhausted|429|quota|unavailable|503/i.test(msg)) { fail++; console.log(`✗ ${d.get("name")} : ${msg.slice(0, 200)}`); break; }
      li++; streak++;
      if (streak >= 30) break;
      if (streak % locs.length === 0) await pause(15_000);
    }
  }
  if (streak >= 30) { console.log("30 refus d'affilée sur tous les points d'accès : arrêt (rien n'est facturé pour les refus)."); break; }
  if (!locs.length) { console.log("Aucun point d'accès ne propose ce modèle : arrêt."); break; }
  await pause(1_000);
}
console.log(`Terminé : ${ok} photo(s), ${fail} échec(s), environ ${(ok * IMAGE_COST).toFixed(2)} $. Par point d'accès : ${[...byLoc].map(([k, v]) => `${k} ${v}`).join(", ") || "—"}.`);
