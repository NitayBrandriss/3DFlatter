import { describe, expect, it } from "vitest";
import { makeEdgeKey } from "../mesh/edgeKey";
import { foldedDihedralQuad, singleFaceClosedLoop, stroke, unitQuad, v } from "../cuts/cutTestFixtures";
import { fenceEdgesFromStrokes, traceStrokeFences } from "./fenceEdgesFromStrokes";
import { openTube, tubeBraceletStroke } from "./testMeshes";

describe("fenceEdgesFromStrokes", () => {
  it("collects the shared diagonal when a stroke crosses a unit quad", () => {
    const mesh = unitQuad();
    const cuts = [stroke("cross", [v(0.7, 0.2), v(0.2, 0.7)])];
    const fence = fenceEdgesFromStrokes(mesh, cuts);

    expect(fence.fenceEdges.has(makeEdgeKey(0, 2))).toBe(true);
    expect(fence.blockerFaces.size).toBeGreaterThan(0);
    expect(fence.warnings).toEqual([]);
  });

  it("falls back to blocker faces when a loop stays inside one face", () => {
    const mesh = unitQuad();
    const fence = fenceEdgesFromStrokes(mesh, [singleFaceClosedLoop()]);

    expect(fence.fenceEdges.size).toBe(0);
    expect(fence.blockerFaces.has(0)).toBe(true);
    expect(fence.warnings).toHaveLength(1);
    expect(fence.warnings[0]).toMatch(/no exit edges/i);
  });

  it("records a dihedral exit edge on the folded quad", () => {
    const mesh = foldedDihedralQuad();
    const cuts = [stroke("fold", [v(0.5, 0.3, 0), v(0, 0.3, 0.5)])];
    const fence = fenceEdgesFromStrokes(mesh, cuts);
    expect(fence.fenceEdges.size).toBeGreaterThan(0);
    expect(fence.blockerFaces.has(0)).toBe(true);
    expect(fence.blockerFaces.has(1)).toBe(true);
  });

  it("two tube bracelets produce fence edges and a wall of band faces", () => {
    const sides = 6;
    const mesh = openTube(5, sides);
    const strokes = [
      tubeBraceletStroke(mesh, "wrist", 0, sides),
      tubeBraceletStroke(mesh, "shoulder", 3, sides),
    ];
    const fence = fenceEdgesFromStrokes(mesh, strokes);
    expect(fence.fenceEdges.size).toBeGreaterThan(0);
    expect(fence.blockerFaces.size).toBeGreaterThan(0);

    const wrist = traceStrokeFences(mesh, strokes[0]!);
    expect(wrist.exitEdges.size).toBeGreaterThan(0);
    expect(wrist.faces.size).toBeGreaterThan(0);
  });
});
