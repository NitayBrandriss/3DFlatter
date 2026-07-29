import { describe, expect, it } from "vitest";
import { makeEdgeKey } from "../mesh/edgeKey";
import type { MeshModel } from "../mesh/types";
import { materializeCutStrokes } from "./materializeCutStrokes";
import type { CutStroke, Vec3 } from "./types";

function makeMesh(vertices: number[], faces: number[]): MeshModel {
  return {
    vertices: new Float32Array(vertices),
    faces: new Uint32Array(faces),
    vertexCount: vertices.length / 3,
    faceCount: faces.length / 3,
  };
}

/** Unit right triangle in XY: (0,0,0)–(1,0,0)–(0,1,0). */
function unitTriangle(): MeshModel {
  return makeMesh([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2]);
}

/** Two triangles sharing edge 0–2 (quad split). */
function unitQuad(): MeshModel {
  return makeMesh(
    [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
    [0, 1, 2, 0, 2, 3],
  );
}

function stroke(id: string, points: Vec3[]): CutStroke {
  return { id, points };
}

function v(x: number, y: number, z = 0): Vec3 {
  return { x, y, z };
}

describe("materializeCutStrokes", () => {
  it("diagonal cut: edge-to-edge chord becomes a seam and splits the face", () => {
    const mesh = unitTriangle();
    // Midpoint of hypotenuse (1,0)–(0,1) and midpoint of (0,0)–(1,0)
    const cuts = [
      stroke("d1", [v(0.5, 0, 0), v(0.5, 0.5, 0)]),
    ];
    // 0.5,0.5 is midpoint of edge 1–2
    const result = materializeCutStrokes(mesh, cuts, new Set());

    expect(result.mesh.faceCount).toBeGreaterThan(1);
    expect(result.mesh.vertexCount).toBeGreaterThanOrEqual(5);
    expect(result.seams.seams.size).toBeGreaterThanOrEqual(1);
    expect(result.manifest).toHaveLength(1);
    expect(result.manifest[0]!.edgeKeys.length).toBeGreaterThanOrEqual(1);
    // Endpoints on boundary → not an open loop for a single triangle
    expect(result.validation.openLoops).toHaveLength(0);
  });

  it("internal stop: interior endpoint fans the face and warns open loop", () => {
    const mesh = unitTriangle();
    const cuts = [stroke("dart", [v(0.5, 0, 0), v(0.25, 0.25, 0)])];
    const result = materializeCutStrokes(mesh, cuts, new Set());

    expect(result.mesh.faceCount).toBeGreaterThanOrEqual(3);
    expect(result.validation.openLoops).toHaveLength(1);
    expect(result.validation.openLoops[0]!.strokeId).toBe("dart");
    expect(result.validation.openLoops[0]!.interiorEndpoints).toContain(1);
    expect(result.warnings.some((w) => w.includes("open loop"))).toBe(true);
    expect(result.seams.seams.size).toBeGreaterThanOrEqual(1);
  });

  it("zigzag (valid): multi-segment cut on one face without self-intersection", () => {
    const mesh = unitTriangle();
    // Non-crossing polyline (previous fixture crossed seg0 vs seg2)
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
    expect(result.seams.seams.size).toBeGreaterThanOrEqual(1);
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

    // Snapped start should be vertex 0 — no extra vertex at nearCorner
    const { vertices, vertexCount } = result.mesh;
    let nearCount = 0;
    for (let i = 0; i < vertexCount; i++) {
      const x = vertices[3 * i]!;
      const y = vertices[3 * i + 1]!;
      const z = vertices[3 * i + 2]!;
      if (Math.hypot(x - 1e-8, y - 1e-8, z) < 1e-9) nearCount++;
    }
    expect(nearCount).toBe(0);
    expect(result.seams.seams.has(makeEdgeKey(0, findClosestVertex(result.mesh, midHyp)))).toBe(
      true,
    );
  });

  it("multi-stroke: later stroke sees subdivided mesh from earlier stroke", () => {
    const mesh = unitQuad();
    // First: vertical cut on left triangle through interior
    const s1 = stroke("a", [v(0, 0.5, 0), v(0.5, 0.5, 0)]);
    // Second: from that region toward right — starts near first cut's interior end
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

    // Parent edge 0-1 was split; children should carry the seam
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
});

function findClosestVertex(mesh: MeshModel, p: Vec3): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < mesh.vertexCount; i++) {
    const dx = mesh.vertices[3 * i]! - p.x;
    const dy = mesh.vertices[3 * i + 1]! - p.y;
    const dz = mesh.vertices[3 * i + 2]! - p.z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
