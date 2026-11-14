export const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/\s+/g, " ").trim();

export const slug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Enlève le pluriel simple d'un mot normalisé. */
export const singular = (w: string) => (w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w);
export const keyOf = (s: string) => norm(s).split(" ").map(singular).join(" ");

const euro = new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" });
/** 2,49 € */
export const eur = (n: number) => euro.format(n).replace(/ | /g, " ");
