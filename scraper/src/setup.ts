// Préparation unique du robot sur ton ordinateur (npm run robot:preparer) :
// ouvre un vrai navigateur avec le profil du robot. Accepte les cookies et choisis ton magasin Colruyt
// (et éventuellement Delhaize / Carrefour), puis ferme simplement la fenêtre.
import { getPersistent, PROFILE_DIR } from "./browser.js"; // lancé avec --local

const ctx = await getPersistent(false);
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto("https://www.colruyt.be/fr");
for (const u of ["https://www.delhaize.be/fr", "https://www.carrefour.be/fr"]) await (await ctx.newPage()).goto(u).catch(() => {});
console.log(`\nProfil du robot : ${PROFILE_DIR}`);
console.log("1. Sur colruyt.be : accepte les cookies et choisis ton magasin (en haut de la page).");
console.log("2. Fais une recherche, par ex. « lait », et vérifie que les prix s'affichent.");
console.log("3. Ferme la fenêtre : c'est enregistré pour les passages suivants.\n");
await new Promise<void>((r) => ctx.on("close", () => r()));
process.exit(0);
