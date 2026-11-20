// Tâche ponctuelle (workflow « Maintenance », oneoff) : diagnostic EN LECTURE SEULE des captures Carrefour / Renmans.
// Structure seulement : les chiffres sont masqués, aucun prix n'apparaît dans le journal public.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "stoemp-app" });
const db = getFirestore();
const mask = (s: string) => s.replace(/\d/g, "#").slice(0, 140);
const caps = (await db.collection("captures").orderBy("at", "desc").limit(40).get()).docs.map((d) => d.data());
for (const c of caps.filter((x) => x.store !== "colruyt").slice(0, 8)) {
  const t = String(c.text || "");
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  console.log(`\n--- ${c.store} · ${new Date(c.at).toISOString()} · ${mask(String(c.url).replace(/^https?:\/\/[^/]+/, ""))}`);
  console.log(`  ${t.length} car., ${lines.length} lignes, ${(t.match(/€/g) || []).length} « € », ${(t.match(/\/\s?kg/gi) || []).length} « /kg »`);
  console.log("  Début :\n    " + lines.slice(0, 8).map(mask).join("\n    "));
  const hints = [...new Set(lines.filter((l) => l.length < 80 && /plus|suivant|page|meer|volgende|more|next|produits|résultats|articles|artikel|résultat|sur \d|van \d/i.test(l)))].slice(0, 20);
  console.log("  Lignes « navigation » :\n    " + hints.map(mask).join("\n    "));
  console.log("  Fin :\n    " + lines.slice(-10).map(mask).join("\n    "));
}
