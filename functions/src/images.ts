import { getFirestore } from "firebase-admin/firestore";
import { GoogleAuth } from "google-auth-library";
import sharp from "sharp";

/**
 * Photos des plats générées par le modèle d'images de Gemini (Vertex AI, dans le projet Google Cloud de Stoemp :
 * pas de clé, pas de licence à afficher). Imagen a été arrêté par Google en 2026 ; modèle réglable par DISH_IMAGE_MODEL.
 * Rangées dans Firestore : `dishThumbs/{recipeId}` (vignette ~6 Ko, liste) et `dishImages/{recipeId}` (~30 Ko, fiche).
 */
export const IMAGE_MODEL = process.env.DISH_IMAGE_MODEL || "gemini-3.1-flash-image";
/** Coût estimé d'une image (journal aiLogs), en $. */
export const IMAGE_COST = 0.04;

type Ing = { itemId: string; qtyPerPerson: number };
export interface RecipeLike { name: string; course?: string; cuisine?: string; ingredients: Ing[]; meat: Ing[] }

const COURSE_SCENE: Record<string, string> = {
  aperitif: "bite-size appetizers on a wooden board", entree: "a starter on a small plate", soupe: "a bowl of soup",
  plat: "a generous home-cooked main course on a plate", accompagnement: "a side dish in a serving dish", dessert: "a dessert",
  patisserie: "a homemade pastry or cake", petitdej: "a breakfast dish",
};
const CUISINE_STYLE: Record<string, string> = {
  belge: "Belgian", francaise: "French", italienne: "Italian", mediterraneenne: "Mediterranean", orientale: "Middle Eastern / North African",
  asiatique: "Asian", indienne: "Indian", latino: "Latin American", americaine: "American / British",
};

/** Description fidèle au plat : nom, ingrédients visibles (les plus importants d'abord), type de plat et cuisine. */
export function dishPrompt(r: RecipeLike, nameOf: (id: string) => string | undefined): string {
  const ings = [...r.meat, ...r.ingredients].sort((a, b) => b.qtyPerPerson - a.qtyPerPerson)
    .map((i) => nameOf(i.itemId)).filter((n): n is string => !!n && !/^(sel|poivre|huile|eau|sucre|farine|levure|bouillon)/i.test(n)).slice(0, 8);
  return [
    `Appetizing realistic food photograph of the dish "${r.name}"`,
    `(${CUISINE_STYLE[r.cuisine || ""] || "home"} cooking, ${COURSE_SCENE[r.course || "plat"] || "a dish"}).`,
    ings.length ? `Visible ingredients, faithful to the recipe: ${ings.join(", ")}.` : "",
    "Authentic traditional presentation as cooked at home, natural daylight, three-quarter view, shallow depth of field, rustic table.",
    "No text, no logo, no hands, no people, a single serving.",
  ].join(" ");
}

let auth: GoogleAuth | null = null;
/** Une image générée (JPEG ou PNG), en 4:3, via l'appel generateContent de Gemini sur Vertex AI (point d'accès « global »). */
export async function generateImage(prompt: string, project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "stoemp-app", model = IMAGE_MODEL): Promise<Buffer> {
  auth ??= new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const url = `https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${model}:generateContent`;
  type Part = { text?: string; inlineData?: { mimeType: string; data: string } };
  const res = await client.request<{ candidates?: { content?: { parts?: Part[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } }>({
    url, method: "POST",
    data: { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "4:3" } } },
  });
  const c = res.data.candidates?.[0];
  const img = c?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
  if (!img) throw new Error(res.data.promptFeedback?.blockReason || c?.finishReason || "Aucune image renvoyée");
  return Buffer.from(img, "base64");
}

/** Génère, compresse et enregistre la photo d'un plat ; renvoie la taille des deux versions. */
export async function makeDishImage(id: string, r: RecipeLike, nameOf: (id: string) => string | undefined, db = getFirestore()) {
  const prompt = dishPrompt(r, nameOf);
  const t0 = Date.now();
  try {
    const raw = await generateImage(prompt);
    const full = await sharp(raw).resize(640, 480, { fit: "cover" }).webp({ quality: 70 }).toBuffer();
    const thumb = await sharp(raw).resize(160, 120, { fit: "cover" }).webp({ quality: 62 }).toBuffer();
    const at = Date.now();
    await db.collection("dishImages").doc(id).set({ d: `data:image/webp;base64,${full.toString("base64")}`, model: IMAGE_MODEL, prompt, at });
    await db.collection("dishThumbs").doc(id).set({ d: `data:image/webp;base64,${thumb.toString("base64")}`, at });
    db.collection("aiLogs").add({ task: "dishImage", model: IMAGE_MODEL, ms: Date.now() - t0, at, cost: IMAGE_COST, recipeId: id }).catch(() => {});
    return { full: full.length, thumb: thumb.length };
  } catch (e) {
    db.collection("aiLogs").add({ task: "dishImage", model: IMAGE_MODEL, ms: Date.now() - t0, at: Date.now(), cost: 0, error: String((e as Error).message || e).slice(0, 300), recipeId: id }).catch(() => {});
    throw e;
  }
}

/** Nombre d'images générées ce mois-ci (plafond des créations automatiques). */
export async function imagesThisMonth(db = getFirestore()) {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const snap = await db.collection("aiLogs").where("task", "==", "dishImage").select("cost", "at").get();
  return snap.docs.filter((x) => (x.get("cost") || 0) > 0 && (x.get("at") || 0) >= start).length;
}
