import { describe, expect, it } from "vitest";
import { NO_NEIGHBOR } from "../mesh/types";
import { buildTopology } from "../mesh/buildTopology";
import { makeEdgeKey } from "../mesh/edgeKey";
import { partitionIslands } from "../mesh/partitionIslands";
import { createSeamRegistry } from "../seams/seamRegistry";
import {
  assertSubsetHasFaces,
  extractFaceSubset,
} from "./extractFaceSubset";
import { createFaceMask, maskFromFaces } from "./faceMask";
import {
  openTube,
  tubeBandFaces,
  tubeCircumferentialLoop,
  tubeVertex,
} from "./testMeshes";

describe("extractFaceSubset", () => {
  it("keeps the full vertex array and original face vertex indices", () => {
    const mesh = {
      vertices: new Float32Array([
        0, 0, 0, 1, 0, 0, 0, 1, 0, -1, 0, 0, 0, 0, 1,
      ]),
      faces: new Uint32Array([0, 1, 2, 0, 2, 3]),
      vertexCount: 5,
      faceCount: 2,
    };
    const mask = maskFromFaces(2, [0]);
    const subset = extractFaceSubset(mesh, mask);

    expect(subset.vertexCount).toBe(5);
    expect(subset.faceCount).toBe(1);
    expect([...subset.vertices]).toEqual([...mesh.vertices]);
    expect([...subset.faces]).toEqual([0, 1, 2]);
  });

  it("packs only masked faces without remapping vertex indices", () => {
    const mesh = openTube(4, 4);
    const keep = [...tubeBandFaces(1, 4), ...tubeBandFaces(2, 4)];
    const mask = maskFromFaces(mesh.faceCount, keep);
    const subset = extractFaceSubset(mesh, mask);

    expect(subset.vertexCount).toBe(mesh.vertexCount);
    expect(subset.faceCount).toBe(keep.length);
    expect([...subset.vertices]).toEqual([...mesh.vertices]);

    for (let i = 0; i < keep.length; i++) {
      const src = 3 * keep[i]!;
      const dst = 3 * i;
      expect(subset.faces[dst]).toBe(mesh.faces[src]);
      expect(subset.faces[dst + 1]).toBe(mesh.faces[src + 1]);
      expect(subset.faces[dst + 2]).toBe(mesh.faces[src + 2]);
    }
  });

  it("makes the isolation boundary a real mesh boundary after buildTopology", () => {
    const sides = 6;
    const mesh = openTube(5, sides);
    const keep = [...tubeBandFaces(1, sides), ...tubeBandFaces(2, sides)];
    const subset = extractFaceSubset(mesh, maskFromFaces(mesh.faceCount, keep));
    const topo = buildTopology(subset);

    for (const key of tubeCircumferentialLoop(1, sides)) {
      const incidents = topo.edgeToFaces.get(key);
      expect(incidents, key).toHaveLength(1);
    }
    for (const key of tubeCircumferentialLoop(3, sides)) {
      const incidents = topo.edgeToFaces.get(key);
      expect(incidents, key).toHaveLength(1);
    }

    const interior = makeEdgeKey(tubeVertex(2, 0, sides), tubeVertex(2, 1, sides));
    expect(topo.edgeToFaces.get(interior)?.length).toBe(2);

    const someBoundary = [...tubeCircumferentialLoop(1, sides)][0]!;
    const inc = topo.edgeToFaces.get(someBoundary)![0]!;
    expect(topo.neighborFaceAcrossEdge[3 * inc.faceId + inc.slot]).toBe(
      NO_NEIGHBOR,
    );
  });

  it("returns faceCount 0 when the mask is empty, still keeping vertices", () => {
    const mesh = openTube(3, 4);
    const subset = extractFaceSubset(mesh, createFaceMask(mesh.faceCount));
    expect(subset.faceCount).toBe(0);
    expect(subset.vertexCount).toBe(mesh.vertexCount);
    expect(subset.faces).toHaveLength(0);
  });

  it("throws when mask length does not match faceCount", () => {
    const mesh = openTube(3, 4);
    expect(() => extractFaceSubset(mesh, createFaceMask(1))).toThrow(
      /mask length/,
    );
  });

  it("ISO-S1-009: disjoint mask → two islands; vertex indices unchanged", () => {
    const mesh = openTube(5, 4);
    const keep = [...tubeBandFaces(1, 4), ...tubeBandFaces(3, 4)];
    const subset = extractFaceSubset(mesh, maskFromFaces(mesh.faceCount, keep));
    expect(subset.vertexCount).toBe(mesh.vertexCount);
    expect([...subset.vertices]).toEqual([...mesh.vertices]);

    const topo = buildTopology(subset);
    const islands = partitionIslands(subset, topo, createSeamRegistry());
    expect(islands).toHaveLength(2);

    // Packed face ids ≠ original: first kept original face becomes subset 0
    expect(keep[0]).toBeGreaterThan(0);
    // subset face 0 verts match original keep[0]
    const src = 3 * keep[0]!;
    expect(subset.faces[0]).toBe(mesh.faces[src]);
    expect(subset.faces[1]).toBe(mesh.faces[src + 1]);
    expect(subset.faces[2]).toBe(mesh.faces[src + 2]);
  });

  it("ISO-S1-009: empty subset must not reach buildTopology unguarded", () => {
    const mesh = openTube(3, 4);
    const subset = extractFaceSubset(mesh, createFaceMask(mesh.faceCount));
    expect(() => assertSubsetHasFaces(subset)).toThrow(/empty isolate subset/);
    expect(() => buildTopology(subset)).toThrow(/no faces/);
  });
});
