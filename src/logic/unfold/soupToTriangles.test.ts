import { describe, expect, it } from "vitest";
import { parseObj } from "../io/obj/parseObj";
import { buildTopology } from "../mesh/buildTopology";
import { unfoldIsland } from "./unfoldIsland";
import { soupToTriangles } from "./soupToTriangles";

const CUBE_OBJ = `
v -1 -1 -1
v 1 -1 -1
v 1 1 -1
v -1 1 -1
v -1 -1 1
v 1 -1 1
v 1 1 1
v -1 1 1
f 1 2 3
f 1 3 4
f 5 6 7
f 5 7 8
f 1 5 8
f 1 8 4
f 2 6 7
f 2 7 3
f 4 3 7
f 4 7 8
f 1 2 6
f 1 6 5
`;

describe("soupToTriangles", () => {
  it("maps each face soup slice to a triangle with finite coords", () => {
    const { mesh } = parseObj(CUBE_OBJ);
    const topo = buildTopology(mesh);
    const result = unfoldIsland(mesh, topo, Array.from({ length: 12 }, (_, i) => i));
    expect(result.error).toBeUndefined();

    const tris = soupToTriangles(result);
    expect(tris).toHaveLength(12);
    expect(tris.map((t) => t.faceId)).toEqual(result.faces);
    for (const item of tris) {
      for (const v of item.tri) {
        expect(Number.isFinite(v.x)).toBe(true);
        expect(Number.isFinite(v.y)).toBe(true);
      }
    }
  });
});
