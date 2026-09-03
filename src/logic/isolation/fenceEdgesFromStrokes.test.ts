import { describe, expect, it } from "vitest";
import { makeEdgeKey } from "../mesh/edgeKey";
import {
  foldedDihedralQuad,
  singleFaceClosedLoop,
  stroke,
  unitQuad,
  v,
} from "../cuts/cutTestFixtures";
import {
  fenceEdgesFromStrokes,
  traceStrokeFences,
} from "./fenceEdgesFromStrokes";
import {
  openTube,
  tubeBandFaces,
  tubeBraceletStroke,
  tubeCircumferentialLoop,
  tubeIncompleteRingStroke,
  tubeRingBraceletStroke,
} from "./testMeshes";

describe("fenceEdgesFromStrokes", () => {
  it("collects the shared diagonal when a stroke crosses a unit quad", () => {
    const mesh = unitQuad();
    const cuts = [stroke("cross", [v(0.7, 0.2), v(0.2, 0.7)])];
    const fence = fenceEdgesFromStrokes(mesh, cuts);

    expect(fence.fenceEdges.has(makeEdgeKey(0, 2))).toBe(true);
    // Hybrid: exits exist → no opaque blockers
    expect(fence.blockerFaces.size).toBe(0);
    expect(fence.walkedFaces.size).toBeGreaterThan(0);
    expect(fence.warnings).toEqual([]);
  });

  it("falls back to blocker faces when a loop stays inside one face", () => {
    const mesh = unitQuad();
    const fence = fenceEdgesFromStrokes(mesh, [singleFaceClosedLoop()]);

    expect(fence.fenceEdges.size).toBe(0);
    expect(fence.blockerFaces.has(0)).toBe(true);
    expect(fence.walkedFaces.has(0)).toBe(true);
    expect(fence.warnings.some((w) => /no exit edges/i.test(w))).toBe(true);
  });

  it("records a dihedral exit edge without dual-side blockers", () => {
    const mesh = foldedDihedralQuad();
    const cuts = [stroke("fold", [v(0.5, 0.3, 0), v(0, 0.3, 0.5)])];
    const fence = fenceEdgesFromStrokes(mesh, cuts);
    expect(fence.fenceEdges.size).toBeGreaterThan(0);
    expect(fence.blockerFaces.size).toBe(0);
    expect(fence.walkedFaces.size).toBeGreaterThan(0);
  });

  it("canonical ring bracelets produce fence edges containing circumferential loops", () => {
    const sides = 6;
    const mesh = openTube(5, sides);
    const strokes = [
      tubeRingBraceletStroke(mesh, "wrist", 1, sides),
      tubeRingBraceletStroke(mesh, "shoulder", 3, sides),
    ];
    const fence = fenceEdgesFromStrokes(mesh, strokes);

    for (const key of tubeCircumferentialLoop(1, sides)) {
      expect(fence.fenceEdges.has(key), key).toBe(true);
    }
    for (const key of tubeCircumferentialLoop(3, sides)) {
      expect(fence.fenceEdges.has(key), key).toBe(true);
    }
    expect(fence.blockerFaces.size).toBe(0);
  });

  it("vertex-ring bracelet does not paint adjacent band as blockers", () => {
    const sides = 6;
    const mesh = openTube(5, sides);
    const fence = fenceEdgesFromStrokes(mesh, [
      tubeRingBraceletStroke(mesh, "ring1", 1, sides),
    ]);
    expect(fence.blockerFaces.size).toBe(0);
    for (const f of tubeBandFaces(1, sides)) {
      expect(fence.blockerFaces.has(f)).toBe(false);
    }
  });

  it("single-point stroke falls back to approximate blockers", () => {
    const mesh = openTube(4, 4);
    const p = {
      x: mesh.vertices[0]!,
      y: mesh.vertices[1]!,
      z: mesh.vertices[2]!,
    };
    const fence = fenceEdgesFromStrokes(mesh, [{ id: "click", points: [p] }]);
    expect(fence.fenceEdges.size).toBe(0);
    expect(fence.blockerFaces.size).toBeGreaterThan(0);
    expect(fence.warnings.some((w) => /no exit edges/i.test(w))).toBe(true);
  });

  it("empty stroke points yield empty fences with no warning", () => {
    const mesh = openTube(3, 4);
    const fence = fenceEdgesFromStrokes(mesh, [{ id: "empty", points: [] }]);
    expect(fence.fenceEdges.size).toBe(0);
    expect(fence.blockerFaces.size).toBe(0);
    expect(fence.warnings).toEqual([]);
  });

  it("duplicate overlapping ring strokes are idempotent for fence keys", () => {
    const sides = 6;
    const mesh = openTube(5, sides);
    const a = tubeRingBraceletStroke(mesh, "a", 2, sides);
    const b = tubeRingBraceletStroke(mesh, "b", 2, sides);
    const once = fenceEdgesFromStrokes(mesh, [a]);
    const twice = fenceEdgesFromStrokes(mesh, [a, b]);
    expect(twice.fenceEdges).toEqual(once.fenceEdges);
    expect(twice.blockerFaces.size).toBe(0);
  });

  it("off-surface segment endpoint warns", () => {
    const mesh = unitQuad();
    const fence = fenceEdgesFromStrokes(mesh, [
      stroke("off", [v(0.3, 0.3), v(0.3, 0.3, 5)]),
    ]);
    expect(fence.warnings.some((w) => /off-surface|locate none/i.test(w))).toBe(
      true,
    );
  });

  it("midpoint bracelet is characterizing (exits or whole-mesh path)", () => {
    const sides = 6;
    const mesh = openTube(5, sides);
    const fence = fenceEdgesFromStrokes(mesh, [
      tubeBraceletStroke(mesh, "mid", 1, sides),
    ]);
    // May produce exits and/or walked faces; blockers only if no exits.
    if (fence.fenceEdges.size > 0) {
      expect(fence.blockerFaces.size).toBe(0);
    } else {
      expect(fence.blockerFaces.size).toBeGreaterThan(0);
    }
    const wrist = traceStrokeFences(mesh, tubeBraceletStroke(mesh, "w", 0, sides));
    expect(wrist.faces.size + wrist.exitEdges.size).toBeGreaterThan(0);
  });

  it("incomplete ring stroke produces a gapped fence (missing loop keys)", () => {
    const sides = 6;
    const mesh = openTube(5, sides);
    const fence = fenceEdgesFromStrokes(mesh, [
      tubeIncompleteRingStroke(mesh, "gap", 2, sides, 0),
    ]);
    const full = tubeCircumferentialLoop(2, sides);
    let missing = 0;
    for (const key of full) {
      if (!fence.fenceEdges.has(key)) missing++;
    }
    expect(missing).toBeGreaterThan(0);
  });
});
