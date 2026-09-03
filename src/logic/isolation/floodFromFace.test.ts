import { describe, expect, it } from "vitest";
import { makeEdgeKey } from "../mesh/edgeKey";
import { buildTopology } from "../mesh/buildTopology";
import { createSeamRegistry, toggleSeam } from "../seams/seamRegistry";
import { floodFromFace } from "./floodFromFace";
import { fenceEdgesFromStrokes } from "./fenceEdgesFromStrokes";
import {
  combineFloodIntoMask,
  countMaskedFaces,
  maskFromFaces,
} from "./faceMask";
import {
  openTube,
  tubeBandFaces,
  tubeBraceletStroke,
  tubeCircumferentialLoop,
} from "./testMeshes";

const RINGS = 5;
const SIDES = 6;

describe("floodFromFace", () => {
  it("covers the whole open tube with no fences", () => {
    const mesh = openTube(RINGS, SIDES);
    const topo = buildTopology(mesh);
    const result = floodFromFace(mesh, topo, 0);
    expect(result.coversAllNonOrphanFaces).toBe(true);
    expect(result.faces).toHaveLength(mesh.faceCount);
  });

  it("stops at two circumferential bracelet loops (band between rings)", () => {
    const mesh = openTube(RINGS, SIDES);
    const topo = buildTopology(mesh);
    const fenceEdges = new Set([
      ...tubeCircumferentialLoop(1, SIDES),
      ...tubeCircumferentialLoop(3, SIDES),
    ]);

    const seed = tubeBandFaces(1, SIDES)[0]!;
    const result = floodFromFace(mesh, topo, seed, { fenceEdges });

    expect(result.coversAllNonOrphanFaces).toBe(false);
    const expected = new Set([
      ...tubeBandFaces(1, SIDES),
      ...tubeBandFaces(2, SIDES),
    ]);
    expect(new Set(result.faces)).toEqual(expected);
    expect(result.faces).toHaveLength(SIDES * 2 * 2);
  });

  it("does not leak past a bracelet into the hand or torso bands", () => {
    const mesh = openTube(RINGS, SIDES);
    const topo = buildTopology(mesh);
    const fenceEdges = new Set([
      ...tubeCircumferentialLoop(1, SIDES),
      ...tubeCircumferentialLoop(3, SIDES),
    ]);
    const seed = tubeBandFaces(2, SIDES)[3]!;
    const flooded = new Set(
      floodFromFace(mesh, topo, seed, { fenceEdges }).faces,
    );

    for (const f of tubeBandFaces(0, SIDES)) {
      expect(flooded.has(f)).toBe(false);
    }
    for (const f of tubeBandFaces(3, SIDES)) {
      expect(flooded.has(f)).toBe(false);
    }
  });

  it("stops at a manual seam the same way as a fence edge", () => {
    const mesh = openTube(RINGS, SIDES);
    const topo = buildTopology(mesh);
    let seams = createSeamRegistry();
    for (const key of tubeCircumferentialLoop(2, SIDES)) {
      seams = toggleSeam(seams, key);
    }

    const seed = tubeBandFaces(0, SIDES)[0]!;
    const result = floodFromFace(mesh, topo, seed, { seams });
    const flooded = new Set(result.faces);

    expect(result.coversAllNonOrphanFaces).toBe(false);
    for (const f of tubeBandFaces(0, SIDES)) expect(flooded.has(f)).toBe(true);
    for (const f of tubeBandFaces(1, SIDES)) expect(flooded.has(f)).toBe(true);
    for (const f of tubeBandFaces(2, SIDES)) expect(flooded.has(f)).toBe(false);
  });

  it("does not expand from a blocker seed (single-face cleanup)", () => {
    const mesh = openTube(RINGS, SIDES);
    const topo = buildTopology(mesh);
    const seed = 4;
    const result = floodFromFace(mesh, topo, seed, {
      blockerFaces: new Set([seed]),
    });
    expect(result.faces).toEqual([seed]);
    expect(result.coversAllNonOrphanFaces).toBe(false);
  });

  it("returns empty for an orphan or out-of-range seed", () => {
    const mesh = {
      vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, -1, 0, 0]),
      faces: new Uint32Array([0, 0, 0, 0, 1, 2]),
      vertexCount: 4,
      faceCount: 2,
    };
    const topo = buildTopology(mesh);
    expect(floodFromFace(mesh, topo, 0).faces).toEqual([]);
    expect(floodFromFace(mesh, topo, 99).faces).toEqual([]);
  });

  it("two stroke bracelets + seed isolate the arm band", () => {
    const mesh = openTube(RINGS, SIDES);
    const topo = buildTopology(mesh);
    const strokes = [
      tubeBraceletStroke(mesh, "wrist", 0, SIDES),
      tubeBraceletStroke(mesh, "shoulder", 3, SIDES),
    ];
    const fence = fenceEdgesFromStrokes(mesh, strokes);
    expect(fence.fenceEdges.size).toBeGreaterThan(0);

    const seed = tubeBandFaces(1, SIDES)[0]!;
    const result = floodFromFace(mesh, topo, seed, {
      fenceEdges: fence.fenceEdges,
      blockerFaces: fence.blockerFaces,
    });

    expect(result.coversAllNonOrphanFaces).toBe(false);
    const flooded = new Set(result.faces);
    for (const f of tubeBandFaces(1, SIDES)) expect(flooded.has(f)).toBe(true);
    for (const f of tubeBandFaces(2, SIDES)) expect(flooded.has(f)).toBe(true);
    for (const f of tubeBandFaces(0, SIDES)) expect(flooded.has(f)).toBe(false);
    for (const f of tubeBandFaces(3, SIDES)) expect(flooded.has(f)).toBe(false);
  });
});

describe("combineFloodIntoMask", () => {
  it("replace / add / subtract", () => {
    const mask = maskFromFaces(8, [1, 2]);
    const added = combineFloodIntoMask(mask, [5], "add");
    expect(countMaskedFaces(added)).toBe(3);
    expect(added[5]).toBe(1);

    const subtracted = combineFloodIntoMask(added, [1], "subtract");
    expect(subtracted[1]).toBe(0);
    expect(countMaskedFaces(subtracted)).toBe(2);

    const replaced = combineFloodIntoMask(subtracted, [0, 7], "replace");
    expect([...replaced]).toEqual([1, 0, 0, 0, 0, 0, 0, 1]);
  });
});

describe("floodFromFace diamond seam", () => {
  it("does not cross a seamed shared edge", () => {
    const mesh = {
      vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, -1, 0, 0]),
      faces: new Uint32Array([0, 1, 2, 0, 2, 3]),
      vertexCount: 4,
      faceCount: 2,
    };
    const topo = buildTopology(mesh);
    let seams = createSeamRegistry();
    seams = toggleSeam(seams, makeEdgeKey(0, 2));
    const result = floodFromFace(mesh, topo, 0, { seams });
    expect(result.faces).toEqual([0]);
    expect(result.coversAllNonOrphanFaces).toBe(false);
  });
});
