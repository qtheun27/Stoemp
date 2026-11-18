import { describe, expect, it } from "vitest";
import { BASE_INDEX, BASE_RECIPES } from "../catalog";
import { artSpec } from "../dishart";
import { loadLibrary } from "../../../scripts/library/format";

const all = [...BASE_RECIPES, ...(loadLibrary().recipes as never[])];
const spec = (name: string) => artSpec(all.find((r) => (r as { name: string }).name === name)!, BASE_INDEX);

describe("illustration des plats", () => {
  it("chaque recette a une illustration", () => {
    for (const r of all) expect(() => artSpec(r, BASE_INDEX)).not.toThrow();
  });
  it("le dessin suit la recette", () => {
    expect(spec("Moules-frites")).toMatchObject({ starch: "frites", protein: "moules" });
    expect(spec("Pâtes carbonara").starch).toBe("pates");
    expect(spec("Soupe aux tomates et boulettes").vessel).toBe("bowl");
    expect(spec("Dame blanche").vessel).toBe("cup");
    expect(spec("Tarte au sucre").vessel).toBe("tart");
    expect(spec("Gaufres de Liège").vessel).toBe("waffle");
    expect(spec("Tiramisu au spéculoos").vessel).toBe("glass");
    expect(spec("Houmous maison").vessel).toBe("board");
  });
});
