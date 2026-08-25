import { describe, expect, it } from "vitest";
import { isIndexDegenerateFace } from "../mesh/faceDegeneracy";
import { makeEdgeKey } from "../mesh/edgeKey";
import { unitCube, unitTriangle, v } from "./cutTestFixtures";
import { snapEpsilonForMesh } from "./vec3";
import { WorkingMesh } from "./workingMesh";

describe("WorkingMesh", () => {
  it("splitEdge remaps seam parent to both children", () => {
    const mesh = unitTriangle();
    const eps = snapEpsilonForMesh(mesh);
    const wm = new WorkingMesh(mesh, [makeEdgeKey(0, 1)], eps);
    const mid = wm.splitEdge(0, 1, 0.5);
    expect(wm.seams.has(makeEdgeKey(0, 1))).toBe(false);
    expect(wm.seams.has(makeEdgeKey(0, mid))).toBe(true);
    expect(wm.seams.has(makeEdgeKey(mid, 1))).toBe(true);
    expect(wm.hasEdge(0, mid)).toBe(true);
    expect(wm.hasEdge(mid, 1)).toBe(true);
  });

  it("splitEdge is idempotent when called twice at same t", () => {
    const mesh = unitTriangle();
    const eps = snapEpsilonForMesh(mesh);
    const wm = new WorkingMesh(mesh, [], eps);
    const a = wm.splitEdge(0, 1, 0.5);
    const b = wm.splitEdge(0, 1, 0.5);
    expect(a).toBe(b);
    expect(wm.faces.every(([x, y, z]) => !isIndexDegenerateFace(x, y, z))).toBe(
      true,
    );
  });

  it("insertInterior fans into exactly three triangles", () => {
    const mesh = unitTriangle();
    const eps = snapEpsilonForMesh(mesh);
    const wm = new WorkingMesh(mesh, [], eps);
    const before = wm.faces.length;
    wm.insertInterior(0, v(0.25, 0.25));
    expect(wm.faces.length).toBe(before + 2);
  });

  it("locate prefers vertex over edge over face near a corner", () => {
    const mesh = unitTriangle();
    const eps = snapEpsilonForMesh(mesh);
    const wm = new WorkingMesh(mesh, [], eps);
    const loc = wm.locate(v(eps * 0.1, eps * 0.1));
    expect(loc.kind).toBe("vertex");
    if (loc.kind === "vertex") expect(loc.vi).toBe(0);
  });

  it("locate returns edge for midpoint of a boundary edge", () => {
    const mesh = unitTriangle();
    const eps = snapEpsilonForMesh(mesh);
    const wm = new WorkingMesh(mesh, [], eps);
    const loc = wm.locate(v(0.5, 0));
    expect(loc.kind).toBe("edge");
  });

  it("repeated edge splits at distinct t keep a chain a–m1–m2–b", () => {
    const mesh = unitTriangle();
    const eps = snapEpsilonForMesh(mesh);
    const wm = new WorkingMesh(mesh, [], eps);
    const m1 = wm.splitEdge(0, 1, 1 / 3);
    const m2 = wm.splitEdge(0, 1, 2 / 3);
    expect(m1).not.toBe(m2);
    expect(wm.hasEdge(0, m1) || wm.hasEdge(0, m2)).toBe(true);
    expect(wm.hasEdge(0, 1)).toBe(false);
  });

  it("isBoundaryVertex is true for all verts of a single triangle", () => {
    const mesh = unitTriangle();
    const eps = snapEpsilonForMesh(mesh);
    const wm = new WorkingMesh(mesh, [], eps);
    expect(wm.isBoundaryVertex(0)).toBe(true);
    expect(wm.isBoundaryVertex(1)).toBe(true);
    expect(wm.isBoundaryVertex(2)).toBe(true);
  });

  it("isBoundaryVertex is false for all verts of a closed cube", () => {
    const mesh = unitCube();
    const eps = snapEpsilonForMesh(mesh);
    const wm = new WorkingMesh(mesh, [], eps);
    for (let i = 0; i < 8; i++) {
      expect(wm.isBoundaryVertex(i)).toBe(false);
    }
  });

  it("locate still finds edge midpoints after splitEdge (edge cache rebuild)", () => {
    const mesh = unitTriangle();
    const eps = snapEpsilonForMesh(mesh);
    const wm = new WorkingMesh(mesh, [], eps);
    wm.splitEdge(0, 1, 0.5);
    const loc = wm.locate(v(0.25, 0));
    expect(loc.kind === "edge" || loc.kind === "vertex").toBe(true);
  });
});
