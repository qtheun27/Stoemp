// Tâche ponctuelle (workflow « Maintenance », oneoff) : reclasse les semaines déjà prévues (lundi → dimanche) dans les semaines
// du foyer quand elles commencent un autre jour (jour des courses). Chaque repas va dans la semaine de sa date ; un repas déjà
// présent au même moment n'est jamais écrasé. Les anciennes fiches sont gardées, marquées `migrated`.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { addDays, mondayOf, weekKeyOf, weekStartFor } from "../../src/lib/season";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
type Slot = { day: number; meal: string; [k: string]: unknown };
for (const hh of (await db.collection("households").get()).docs) {
  const st = (await hh.ref.collection("meta").doc("settings").get()).data() || {};
  const ws = weekStartFor(st as never);
  if (!ws) continue;
  const weeks = (await hh.ref.collection("weeks").get()).docs.filter((d) => /^\d+-W\d+$/.test(d.id) && !d.get("migrated"));
  let moved = 0;
  for (const w of weeks) {
    const mon = mondayOf(w.id), by = new Map<string, Slot[]>();
    for (const sl of (w.get("slots") || []) as Slot[]) {
      const key = weekKeyOf(addDays(mon, sl.day), ws);
      by.set(key, [...(by.get(key) || []), sl]);
    }
    for (const [key, add] of by) {
      const ref = hh.ref.collection("weeks").doc(key), cur = (await ref.get()).data();
      const have = (cur?.slots || []) as Slot[];
      const fresh = add.filter((a) => !have.some((h) => h.day === a.day && h.meal === a.meal));
      if (!fresh.length) continue;
      await ref.set({ ...(cur || { persons: w.get("persons") ?? null }), slots: [...have, ...fresh] }, { merge: true });
      moved += fresh.length;
    }
    await w.ref.update({ migrated: true });
  }
  if (weeks.length) console.log(`Foyer ${hh.id.slice(0, 6)}… (semaine dès le jour ${ws}) : ${weeks.length} semaines reprises, ${moved} repas reclassés`);
}
