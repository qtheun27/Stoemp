import { doc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { BASE_INDEX } from "../lib/catalog";
import { addDays, today, ymd } from "../lib/season";
import { defaultLocation } from "../state/actions";

/** Données de démo : un peu de stock et un historique d'achats, pour tester la prédiction sans robot ni magasin. */
export async function seedDemo(hid: string) {
  const b = writeBatch(db);
  const t = today();
  const stock: [string, number, number | null][] = [
    ["lait", 1500, null], ["oeufs", 6, 12], ["pates", 800, null], ["riz", 600, null], ["pommes-de-terre", 1800, 20],
    ["carottes", 500, 5], ["oignon", 5, null], ["beurre", 150, 25], ["papier-toilette", 5, null], ["cafe-moulu", 250, null],
    ["epinards-frais", 300, 2], ["yaourt-nature", 400, 6], ["liquide-vaisselle", 300, null], ["tomates-concassees", 800, null],
  ];
  for (const [id, qty, expIn] of stock) {
    const item = BASE_INDEX.get(id)!;
    b.set(doc(db, "households", hid, "stock", id), { qty, unit: item.unit, location: defaultLocation(item.category), expiresAt: expIn != null ? ymd(addDays(t, expIn)) : null, minQty: null, updatedAt: Date.now() });
  }
  // Historique : achats réguliers → prédictions crédibles dès le premier jour.
  const history: [string, number, number][] = [["lait", 2000, 6], ["papier-toilette", 12, 21], ["cafe-moulu", 500, 14], ["oeufs", 12, 9], ["pain-gris", 1, 3]];
  for (const [id, qty, every] of history) {
    const events = [5, 4, 3, 2, 1].map((k) => ({ date: ymd(addDays(t, -k * every)), qty, type: "achat" }));
    b.set(doc(db, "households", hid, "consumption", id), { events, dailyRate: 0, rateConfidence: "aucune", nextRunOut: null });
  }
  b.set(doc(db, "households", hid, "meta", "prefs"), {
    favorites: ["base-stoemp-aux-carottes-et-saucisse", "base-carbonnade-flamande"], learnedCategories: {},
    history: { "papier toilette": { name: "Papier toilette", count: 4, itemId: "papier-toilette", category: "dr" }, "cafe moulu": { name: "Café moulu", count: 3, itemId: "cafe-moulu", category: "ep" }, "banane": { name: "Bananes", count: 3, itemId: "bananes", category: "fl" } },
  }, { merge: true });
  await b.commit();
}
