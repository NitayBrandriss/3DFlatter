import { describe, expect, it } from "vitest";
import { makeEdgeKey } from "../mesh/edgeKey";
import {
  findClosestVertex,
  foldedDihedralQuad,
  stroke,
  unitQuad,
  unitTriangle,
  v,
} from "./cutTestFixtures";
import { seamEdgesExistOnMesh } from "./cutTestAssertions";
import { materializeCutStrokes } from "./materializeCutStrokes";

describe("materializeCutStrokes", () => {
  it("diagonal cut: edge-to-edge chord becomes a seam and splits the face", () => {
    const mesh = unitTriangle();
    const cuts = [stroke("d1", [v(0.5, 0, 0), v(0.5, 0.5, 0)])];
    const result = materializeCutStrokes(mesh, cuts, new Set());

    expect(result.mesh.faceCount).toBe(3);
    expect(result.mesh.vertexCount).toBe(5);
    expect(result.seams.seams.size).toBeGreaterThanOrEqual(1);
    expect(result.manifest).toHaveLength(1);
    expect(result.manifest[0]!.edgeKeys.length).toBe(1);
    expect(result.validation.openLoops).toHaveLength(0);
    expect(seamEdgesExistOnMesh(result.mesh, result.seams.seams)).toBe(true);
  });

  it("internal stop: interior endpoint fans the face and warns open loop", () => {
    const mesh = unitTriangle();
    const cuts = [stroke("dart", [v(0.5, 0, 0), v(0.25, 0.25, 0)])];
    const result = materializeCutStrokes(mesh, cuts, new Set());

    expect(result.mesh.faceCount).toBe(4);
    expect(result.validation.openLoops).toHaveLength(1);
    expect(result.validation.openLoops[0]!.strokeId).toBe("dart");
    expect(result.validation.openLoops[0]!.interiorEndpoints).toContain(1);
    expect(result.warnings.some((w) => w.includes("open loop"))).toBe(true);
    expect(result.seams.seams.size).toBeGreaterThanOrEqual(1);
  });

  it("zigzag (valid): multi-segment cut on one face without self-intersection", () => {
    const mesh = unitTriangle();
    const cuts = [
      stroke("zz", [
        v(0.15, 0),
        v(0.25, 0.15),
        v(0.4, 0.08),
        v(0.55, 0.2),
      ]),
    ];
    const result = materializeCutStrokes(mesh, cuts, new Set());

    expect(result.warnings.some((w) => w.includes("self-intersecting"))).toBe(
      false,
    );
    expect(result.manifest.length).toBe(3);
    expect(result.seams.seams.size).toBeGreaterThanOrEqual(2);
    expect(result.mesh.faceCount).toBeGreaterThan(1);
  });

  it("near-vertex snap: endpoint near a corner reuses that vertex", () => {
    const mesh = unitTriangle();
    const nearCorner = v(1e-8, 1e-8, 0);
    const midHyp = v(0.5, 0.5, 0);
    const result = materializeCutStrokes(
      mesh,
      [stroke("snap", [nearCorner, midHyp])],
      new Set(),
    );

    const { vertices, vertexCount } = result.mesh;
    let nearCount = 0;
    for (let i = 0; i < vertexCount; i++) {
      const x = vertices[3 * i]!;
      const y = vertices[3 * i + 1]!;
      const z = vertices[3 * i + 2]!;
      if (Math.hypot(x - 1e-8, y - 1e-8, z) < 1e-9) nearCount++;
    }
    expect(nearCount).toBe(0);
    expect(
      result.seams.seams.has(makeEdgeKey(0, findClosestVertex(result.mesh, midHyp))),
    ).toBe(true);
  });

  it("multi-stroke: later stroke sees subdivided mesh from earlier stroke", () => {
    const mesh = unitQuad();
    const s1 = stroke("a", [v(0, 0.5, 0), v(0.5, 0.5, 0)]);
    const s2 = stroke("b", [v(0.5, 0.5, 0), v(1, 0.5, 0)]);

    const one = materializeCutStrokes(mesh, [s1], new Set());
    const both = materializeCutStrokes(mesh, [s1, s2], new Set());

    expect(both.mesh.vertexCount).toBeGreaterThanOrEqual(one.mesh.vertexCount);
    expect(both.seams.seams.size).toBeGreaterThanOrEqual(one.seams.seams.size);
    expect(both.manifest.filter((m) => m.strokeId === "a").length).toBe(1);
    expect(both.manifest.filter((m) => m.strokeId === "b").length).toBe(1);
  });

  it("unions manual seams and remaps them when the edge is split", () => {
    const mesh = unitTriangle();
    const manual = new Set([makeEdgeKey(0, 1)]);
    const result = materializeCutStrokes(
      mesh,
      [stroke("split", [v(0.5, 0, 0), v(0.25, 0.25, 0)])],
      manual,
    );

    expect(result.seams.seams.has(makeEdgeKey(0, 1))).toBe(false);
    const midOn01 = findClosestVertex(result.mesh, v(0.5, 0, 0));
    expect(result.seams.seams.has(makeEdgeKey(0, midOn01))).toBe(true);
    expect(result.seams.seams.has(makeEdgeKey(midOn01, 1))).toBe(true);
  });

  it("does not mutate the input mesh buffers", () => {
    const mesh = unitTriangle();
    const vertsBefore = Array.from(mesh.vertices);
    const facesBefore = Array.from(mesh.faces);
    materializeCutStrokes(
      mesh,
      [stroke("x", [v(0.5, 0, 0), v(0.25, 0.25, 0)])],
      new Set(),
    );
    expect(Array.from(mesh.vertices)).toEqual(vertsBefore);
    expect(Array.from(mesh.faces)).toEqual(facesBefore);
  });

  it("builds topology for the derived mesh", () => {
    const mesh = unitTriangle();
    const result = materializeCutStrokes(
      mesh,
      [stroke("d", [v(0.5, 0, 0), v(0.5, 0.5, 0)])],
      new Set(),
    );
    expect(result.topology.edgeToFaces.size).toBeGreaterThan(0);
    expect(result.topology.neighborFaceAcrossEdge.length).toBe(
      result.mesh.faceCount * 3,
    );
  });

  it("dihedral segment: wing A to wing B marks seam across shared edge", () => {
    const mesh = foldedDihedralQuad();
    const result = materializeCutStrokes(
      mesh,
      [stroke("dihedral", [v(0.5, 0.3, 0), v(0, 0.3, 0.5)])],
      new Set(),
    );

    expect(
      result.warnings.filter((w) => w.includes("could not connect")),
    ).toEqual([]);
    expect(result.seams.seams.size).toBeGreaterThanOrEqual(1);
    expect(result.manifest[0]!.edgeKeys.length).toBeGreaterThanOrEqual(1);
    expect(seamEdgesExistOnMesh(result.mesh, result.seams.seams)).toBe(true);
  });

  it("dihedral segment: two points on wing B marks seam in-plane", () => {
    const mesh = foldedDihedralQuad();
    const result = materializeCutStrokes(
      mesh,
      [stroke("wing-b", [v(0, 0.2, 0.3), v(0, 0.4, 0.3)])],
      new Set(),
    );

    expect(
      result.warnings.filter((w) => w.includes("could not connect")),
    ).toEqual([]);
    expect(result.manifest[0]!.edgeKeys.length).toBeGreaterThanOrEqual(1);
  });
});
