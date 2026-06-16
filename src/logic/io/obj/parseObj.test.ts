import { describe, expect, it } from "vitest";
import { buildTopology } from "../../mesh/buildTopology";
import { partitionIslands } from "../../mesh/partitionIslands";
import { summarizeTopology } from "../../mesh/topologyStats";
import { createSeamRegistry } from "../../seams/seamRegistry";
import { parseObj } from "./parseObj";
import { unweldedIcosahedronObj } from "./testMeshes";

describe("parseObj", () => {
  it("welds per-face vertices so a closed icosahedron is one island", () => {
    const { mesh, warnings } = parseObj(unweldedIcosahedronObj());
    expect(warnings).toHaveLength(0);
    expect(mesh).toMatchObject({ vertexCount: 12, faceCount: 20 });

    const topo = buildTopology(mesh);
    expect(summarizeTopology(topo).boundaryEdgesCount).toBe(0);

    const islands = partitionIslands(mesh, topo, createSeamRegistry());
    expect(islands).toHaveLength(1);
    expect(islands[0]).toHaveLength(20);
  });

  it("warns on a concave quad but still fan-triangulates", () => {
    const obj = `
v 0 0 0
v 4 0 0
v 1 1 0
v 0 4 0
f 1 2 3 4
`;
    const { mesh, warnings } = parseObj(obj);
    expect(warnings).toEqual([
      { kind: "concave_ngon", line: 6, vertexCount: 4 },
    ]);
    expect(mesh.faceCount).toBe(2);
  });

  it("does not warn on a convex quad", () => {
    const obj = `
v 0 0 0
v 2 0 0
v 2 2 0
v 0 2 0
f 1 2 3 4
`;
    const { mesh, warnings } = parseObj(obj);
    expect(warnings).toHaveLength(0);
    expect(mesh.faceCount).toBe(2);
  });
});
