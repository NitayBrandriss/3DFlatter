import { describe, expect, it } from "vitest";
import { parseObj } from "../io/obj/parseObj";
import { unweldedIcosahedronObj } from "../io/obj/testMeshes";
import { buildTopology } from "../mesh/buildTopology";
import { buildUnfoldTreeEdges, expectedTreeEdgeCount } from "./buildUnfoldTreeEdges";

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

describe("buildUnfoldTreeEdges", () => {
  it("produces |F|-1 tree edges for a closed cube island", () => {
    const { mesh } = parseObj(CUBE_OBJ);
    const topo = buildTopology(mesh);
    const islandFaces = Array.from({ length: 12 }, (_, i) => i);
    const tree = buildUnfoldTreeEdges(mesh, topo, islandFaces);

    expect(tree.size).toBe(expectedTreeEdgeCount(islandFaces.length));
    expect(tree.size).toBe(11);
  });

  it("produces |F|-1 tree edges for a welded icosahedron island", () => {
    const { mesh } = parseObj(unweldedIcosahedronObj());
    const topo = buildTopology(mesh);
    const islandFaces = Array.from({ length: 20 }, (_, i) => i);
    const tree = buildUnfoldTreeEdges(mesh, topo, islandFaces);

    expect(tree.size).toBe(19);
  });
});
