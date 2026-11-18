// Vérifie les recettes écrites à la main, sans rien envoyer : npx tsx scripts/library/check.mts
import { loadLibrary } from "./format";

const { recipes, errors } = loadLibrary();
const count = new Map<string, number>();
for (const r of recipes) count.set(`${r.cuisine}/${r.course}`, (count.get(`${r.cuisine}/${r.course}`) || 0) + 1);
console.log([...count].map(([k, v]) => `${k} ${v}`).join(" · "));
console.log(`${recipes.length} recettes, ${errors.length} erreurs`);
if (errors.length) { console.log(errors.join("\n")); process.exit(1); }
