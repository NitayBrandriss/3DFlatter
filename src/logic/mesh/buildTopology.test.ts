import { describe, expect, it } from "vitest";
import { parseObj } from "../io/obj/parseObj";
import { buildTopology } from "./buildTopology";
import { makeEdgeKey } from "./edgeKey";
import { summarizeTopology } from "./topologyStats";
import type { MeshModel } from "./types";
import { NO_NEIGHBOR, getNeighborAcrossEdge, neighborIndex } from "./types";

function makeMesh(vertices: number[], faces: number[]): MeshModel {
  return {
    vertices: new Float32Array(vertices),
    faces: new Uint32Array(faces),
    vertexCount: vertices.length / 3,
    faceCount: faces.length / 3,
  };
}

/** Unit cube: 8 verts, 12 tris (2 per face). */
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

describe("buildTopology", () => {
  it("pairs two triangles sharing one edge via flat neighbor buffer", () => {
    // Diamond: tri 0 (0,1,2), tri 1 (0,2,3) share edge 0-2
    const mesh = makeMesh(
      [0, 0, 0, 1, 0, 0, 0, 1, 0, -1, 0, 0],
      [0, 1, 2, 0, 2, 3],
    );
    const topo = buildTopology(mesh);
    const sharedKey = makeEdgeKey(0, 2);

    const incidents = topo.edgeToFaces.get(sharedKey)!;
    expect(incidents).toHaveLength(2);
    expect(incidents[0]!.faceId).not.toBe(incidents[1]!.faceId);

    const fA = incidents[0]!.faceId;
    const slotA = incidents[0]!.slot;
    const fB = incidents[1]!.faceId;
    const slotB = incidents[1]!.slot;

    expect(topo.neighborFaceAcrossEdge[neighborIndex(fA, slotA)]).toBe(fB);
    expect(topo.neighborFaceAcrossEdge[neighborIndex(fB, slotB)]).toBe(fA);
  });

  it("treats a single triangle as three boundary edges", () => {
    const mesh = makeMesh([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2]);
    const topo = buildTopology(mesh);

    expect(topo.edgeToFaces.size).toBe(3);
    for (const incidents of topo.edgeToFaces.values()) {
      expect(incidents).toHaveLength(1);
    }

    expect(getNeighborAcrossEdge(topo, 0, 0)).toBeNull();
    expect(getNeighborAcrossEdge(topo, 0, 1)).toBeNull();
    expect(getNeighborAcrossEdge(topo, 0, 2)).toBeNull();
    expect(topo.neighborFaceAcrossEdge.every((n) => n === NO_NEIGHBOR)).toBe(true);
  });

  it("builds a closed cube with no boundary or non-manifold edges", () => {
    const mesh = parseObj(CUBE_OBJ);
    const topo = buildTopology(mesh);
    const summary = summarizeTopology(topo);

    expect(summary.boundaryEdgesCount).toBe(0);
    expect(summary.nonManifoldEdgesCount).toBe(0);
    expect(summary.manifoldEdgesCount).toBeGreaterThan(0);
    expect(topo.neighborFaceAcrossEdge.length).toBe(3 * mesh.faceCount);
    expect(topo.skippedDegenerateFaceCount).toBe(0);
  });

  it("skips degenerate faces without polluting edge keys", () => {
    const mesh = makeMesh(
      [0, 0, 0, 1, 0, 0, 0, 1, 0],
      [
        0, 1, 2, // valid
        0, 0, 1, // degenerate (v0 === v1)
      ],
    );
    const topo = buildTopology(mesh);

    expect(topo.skippedDegenerateFaceCount).toBe(1);
    for (const key of topo.edgeToFaces.keys()) {
      expect(key).not.toMatch(/^(\d+),\1$/);
    }
    expect(() => buildTopology(mesh)).not.toThrow();
  });

  it("throws on empty face count", () => {
    const mesh = makeMesh([0, 0, 0], []);
    expect(() => buildTopology(mesh)).toThrow(/no faces/);
  });
});

describe("summarizeTopology", () => {
  it("counts boundary, manifold, and non-manifold edges", () => {
    const mesh = makeMesh([0, 0, 0, 1, 0, 0, 0, 1, 0, -1, 0, 0], [0, 1, 2, 0, 2, 3]);
    const topo = buildTopology(mesh);
    const summary = summarizeTopology(topo);

    expect(summary.manifoldEdgesCount).toBe(1);
    expect(summary.boundaryEdgesCount).toBe(4);
    expect(summary.nonManifoldEdgesCount).toBe(0);
  });
});
