import { describe, expect, it } from "vitest";
import { buildTopology } from "../../mesh/buildTopology";
import { partitionIslands } from "../../mesh/partitionIslands";
import { summarizeTopology } from "../../mesh/topologyStats";
import { createSeamRegistry } from "../../seams/seamRegistry";
import { parseObj } from "./parseObj";
import { unweldedIcosahedronObj } from "./testMeshes";

describe("parseObj", () => {
  it("welds per-face vertices so a closed icosahedron is one island", () => {
    const mesh = parseObj(unweldedIcosahedronObj());
    expect(mesh).toMatchObject({ vertexCount: 12, faceCount: 20 });

    const topo = buildTopology(mesh);
    expect(summarizeTopology(topo).boundaryEdgesCount).toBe(0);

    const islands = partitionIslands(mesh, topo, createSeamRegistry());
    expect(islands).toHaveLength(1);
    expect(islands[0]).toHaveLength(20);
  });
});
