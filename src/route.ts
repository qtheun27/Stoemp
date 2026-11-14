import { useEffect, useState } from "react";

/** Routage par ancre (#/semaine…) : fonctionne sur GitHub Pages sans configuration serveur. */
export function useRoute() {
  const get = () => location.hash.replace(/^#\/?/, "") || "semaine";
  const [r, setR] = useState(get);
  useEffect(() => { const f = () => { setR(get()); scrollTo(0, 0); }; addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return r;
}
export const go = (path: string) => { location.hash = "/" + path; };
