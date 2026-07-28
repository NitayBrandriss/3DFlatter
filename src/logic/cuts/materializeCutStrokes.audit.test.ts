/**
 * Adversarial QA audit suite for Slice 1 cut materialize (ADR 0100).
 * Intentionally tries to break geometry / topology — failures are audit findings.
 */
import { describe, expect, it } from "vitest";
import { isIndexDegenerateFace } from "../mesh/faceDegeneracy";
import { makeEdgeKey } from "../mesh/edgeKey";
import type { MeshModel } from "../mesh/types";
import { materializeCutStrokes } from "./materializeCutStrokes";
import type { CutStroke, Vec3 } from "./types";
import { distSq, snapEpsilonForMesh } from "./vec3";
import { WorkingMesh } from "./workingMesh";

function makeMesh(vertices: number[], faces: number[]): MeshModel {
  return {
    vertices: new Float32Array(vertices),
    faces: new Uint32Array(faces),
    vertexCount: vertices.length / 3,
    faceCount: faces.length / 3,
  };
}

function unitTriangle(): MeshModel {
  return makeMesh([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2]);
}

function unitQuad(): MeshModel {
  return makeMesh(
    [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
    [0, 1, 2, 0, 2, 3],
  );
}

/** Unit cube centered at origin, 12 tris, closed manifold. */
function unitCube(): MeshModel {
  const p = [
    [-0.5, -0.5, -0.5],
    [0.5, -0.5, -0.5],
    [0.5, 0.5, -0.5],
    [-0.5, 0.5, -0.5],
    [-0.5, -0.5, 0.5],
    [0.5, -0.5, 0.5],
    [0.5, 0.5, 0.5],
    [-0.5, 0.5, 0.5],
  ];
  const verts: number[] = [];
  for (const [x, y, z] of p) verts.push(x!, y!, z!);
  // Each face: two tris, outward-ish winding
  const faces = [
    0, 1, 2, 0, 2, 3, // -Z
    4, 6, 5, 4, 7, 6, // +Z
    0, 4, 5, 0, 5, 1, // -Y
    2, 6, 7, 2, 7, 3, // +Y
    0, 3, 7, 0, 7, 4, // -X
    1, 5, 6, 1, 6, 2, // +X
  ];
  return makeMesh(verts, faces);
}

function stroke(id: string, points: Vec3[]): CutStroke {
  return { id, points };
}

function v(x: number, y: number, z = 0): Vec3 {
  return { x, y, z };
}

function readV(mesh: MeshModel, i: number): Vec3 {
  return {
    x: mesh.vertices[3 * i]!,
    y: mesh.vertices[3 * i + 1]!,
    z: mesh.vertices[3 * i + 2]!,
  };
}

function faceArea3(mesh: MeshModel, fi: number): number {
  const a = readV(mesh, mesh.faces[3 * fi]!);
  const b = readV(mesh, mesh.faces[3 * fi + 1]!);
  const c = readV(mesh, mesh.faces[3 * fi + 2]!);
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const acx = c.x - a.x;
  const acy = c.y - a.y;
  const acz = c.z - a.z;
  const cx = aby * acz - abz * acy;
  const cy = abz * acx - abx * acz;
  const cz = abx * acy - aby * acx;
  return 0.5 * Math.hypot(cx, cy, cz);
}

function totalArea(mesh: MeshModel): number {
  let s = 0;
  for (let fi = 0; fi < mesh.faceCount; fi++) s += faceArea3(mesh, fi);
  return s;
}

function hasIndexDegenerateFaces(mesh: MeshModel): boolean {
  for (let fi = 0; fi < mesh.faceCount; fi++) {
    const a = mesh.faces[3 * fi]!;
    const b = mesh.faces[3 * fi + 1]!;
    const c = mesh.faces[3 * fi + 2]!;
    if (isIndexDegenerateFace(a, b, c)) return true;
  }
  return false;
}

/** Max undirected edge face-incidence (manifold surface ⇒ ≤ 2). */
function maxEdgeIncidence(mesh: MeshModel): number {
  const counts = new Map<string, number>();
  for (let fi = 0; fi < mesh.faceCount; fi++) {
    const a = mesh.faces[3 * fi]!;
    const b = mesh.faces[3 * fi + 1]!;
    const c = mesh.faces[3 * fi + 2]!;
    for (const key of [makeEdgeKey(a, b), makeEdgeKey(b, c), makeEdgeKey(c, a)]) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  let max = 0;
  for (const n of counts.values()) if (n > max) max = n;
  return max;
}

function seamEdgesExistOnMesh(mesh: MeshModel, seams: Set<string>): boolean {
  const present = new Set<string>();
  for (let fi = 0; fi < mesh.faceCount; fi++) {
    const a = mesh.faces[3 * fi]!;
    const b = mesh.faces[3 * fi + 1]!;
    const c = mesh.faces[3 * fi + 2]!;
    present.add(makeEdgeKey(a, b));
    present.add(makeEdgeKey(b, c));
    present.add(makeEdgeKey(c, a));
  }
  for (const s of seams) {
    if (!present.has(s)) return false;
  }
  return true;
}

function findClosestVertex(mesh: MeshModel, p: Vec3): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < mesh.vertexCount; i++) {
    const d = distSq(readV(mesh, i), p);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

describe("QA audit: materializeCutStrokes adversarial", () => {
  describe("degenerate / malformed stroke inputs", () => {
    it("skips empty point list without throwing", () => {
      const result = materializeCutStrokes(
        unitTriangle(),
        [stroke("empty", [])],
        new Set(),
      );
      expect(result.mesh.faceCount).toBe(1);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.seams.seams.size).toBe(0);
    });

    it("skips single-point stroke", () => {
      const result = materializeCutStrokes(
        unitTriangle(),
        [stroke("one", [v(0.2, 0.2)])],
        new Set(),
      );
      expect(result.mesh.faceCount).toBe(1);
      expect(result.warnings.some((w) => w.includes("fewer than 2"))).toBe(true);
    });

    it("zero-length segment (duplicate endpoints) yields no seam", () => {
      const result = materializeCutStrokes(
        unitTriangle(),
        [stroke("zero", [v(0.5, 0), v(0.5, 0)])],
        new Set(),
      );
      expect(result.seams.seams.size).toBe(0);
      expect(result.manifest[0]?.edgeKeys ?? []).toEqual([]);
    });

    it("all-points-coincident polyline does not corrupt mesh", () => {
      const p = v(0.25, 0.25);
      const result = materializeCutStrokes(
        unitTriangle(),
        [stroke("blob", [p, p, p, p])],
        new Set(),
      );
      expect(hasIndexDegenerateFaces(result.mesh)).toBe(false);
      expect(result.mesh.faceCount).toBeGreaterThanOrEqual(1);
    });

    it("NaN coordinates do not throw and leave a valid mesh", () => {
      const result = materializeCutStrokes(
        unitTriangle(),
        [stroke("nan", [v(NaN, NaN, NaN), v(0.5, 0)])],
        new Set(),
      );
      expect(result.mesh.faceCount).toBeGreaterThan(0);
      expect(hasIndexDegenerateFaces(result.mesh)).toBe(false);
      expect(Number.isFinite(totalArea(result.mesh))).toBe(true);
    });

    it("Infinity coordinates do not throw", () => {
      expect(() =>
        materializeCutStrokes(
          unitTriangle(),
          [stroke("inf", [v(Infinity, 0, 0), v(0.5, 0.5)])],
          new Set(),
        ),
      ).not.toThrow();
    });
  });

  describe("self-intersection rejection (ADR 0100)", () => {
    it("rejects classic bowtie / crossing polyline on a face", () => {
      // Segments (0.2,0.05)–(0.6,0.35) and (0.55,0.05)–(0.15,0.35) cross
      const result = materializeCutStrokes(
        unitTriangle(),
        [
          stroke("x", [
            v(0.2, 0.05),
            v(0.6, 0.35),
            v(0.55, 0.05),
            v(0.15, 0.35),
          ]),
        ],
        new Set(),
      );
      expect(result.warnings.some((w) => w.includes("self-intersecting"))).toBe(
        true,
      );
      expect(result.seams.seams.size).toBe(0);
      expect(result.mesh.faceCount).toBe(1);
    });

    it("does not reject a simple open polyline that only shares joints", () => {
      const result = materializeCutStrokes(
        unitTriangle(),
        [
          stroke("ok", [
            v(0.1, 0),
            v(0.3, 0.2),
            v(0.5, 0.05),
          ]),
        ],
        new Set(),
      );
      expect(result.warnings.some((w) => w.includes("self-intersecting"))).toBe(
        false,
      );
    });

    it("closed square loop on a face is not flagged as self-intersecting", () => {
      // Closed: first ≈ last; non-adjacent segments meet only at shared corners
      const result = materializeCutStrokes(
        unitQuad(),
        [
          stroke("loop", [
            v(0.2, 0.2),
            v(0.8, 0.2),
            v(0.8, 0.8),
            v(0.2, 0.8),
            v(0.2, 0.2),
          ]),
        ],
        new Set(),
      );
      expect(result.warnings.some((w) => w.includes("self-intersecting"))).toBe(
        false,
      );
    });

    it("detects self-intersection of nearly-coplanar skew segments that touch in 3D", () => {
      // Two segments that nearly cross in XY but with tiny Z offset —
      // ADR wants per-face surface cuts; false negatives leave crossing cuts.
      const result = materializeCutStrokes(
        unitTriangle(),
        [
          stroke("skew", [
            v(0.2, 0.05, 1e-9),
            v(0.6, 0.35, -1e-9),
            v(0.55, 0.05, 1e-9),
            v(0.15, 0.35, -1e-9),
          ]),
        ],
        new Set(),
      );
      // Strict expectation: should still reject (surface intent)
      expect(result.warnings.some((w) => w.includes("self-intersecting"))).toBe(
        true,
      );
    });

    it("rejects open 4-point bowtie (first segment vs last — closed-stroke exclusion trap)", () => {
      // points.length===4 ⇒ the only non-adjacent pair is (seg0, seg2) which
      // equals (first, last). Blind closed-stroke skip hides all 4-pt crossings.
      const result = materializeCutStrokes(
        unitTriangle(),
        [
          stroke("bow4", [
            v(0.15, 0.02),
            v(0.55, 0.4),
            v(0.5, 0.02),
            v(0.1, 0.4),
          ]),
        ],
        new Set(),
      );
      expect(result.warnings.some((w) => w.includes("self-intersecting"))).toBe(
        true,
      );
      expect(result.mesh.faceCount).toBe(1);
    });

    it("rejects when middle non-adjacent segments cross (not first/last pair)", () => {
      // 6 points: seg1 crosses seg3 — neither is the (0, last) pair
      const result = materializeCutStrokes(
        unitTriangle(),
        [
          stroke("midX", [
            v(0.05, 0.02), // start
            v(0.2, 0.05), // seg0
            v(0.65, 0.35), // seg1 — crosses seg3
            v(0.5, 0.08), // seg2
            v(0.1, 0.35), // seg3
            v(0.15, 0.1), // seg4
          ]),
        ],
        new Set(),
      );
      expect(result.warnings.some((w) => w.includes("self-intersecting"))).toBe(
        true,
      );
    });

    it("bowtie that slips through leaves ghost/orphan topology risk (document outcome)", () => {
      const result = materializeCutStrokes(
        unitTriangle(),
        [
          stroke("slip", [
            v(0.2, 0.05),
            v(0.6, 0.35),
            v(0.55, 0.05),
            v(0.15, 0.35),
          ]),
        ],
        new Set(),
      );
      // If self-intersect was missed, materialize may still run — seams must be real edges
      if (!result.warnings.some((w) => w.includes("self-intersecting"))) {
        expect(hasIndexDegenerateFaces(result.mesh)).toBe(false);
        expect(seamEdgesExistOnMesh(result.mesh, result.seams.seams)).toBe(true);
        expect(maxEdgeIncidence(result.mesh)).toBeLessThanOrEqual(2);
      }
    });
  });

  describe("topological invariants after cuts", () => {
    it("preserves total surface area for an edge-to-edge diagonal cut", () => {
      const mesh = unitTriangle();
      const before = totalArea(mesh);
      const result = materializeCutStrokes(
        mesh,
        [stroke("d", [v(0.5, 0), v(0.5, 0.5)])],
        new Set(),
      );
      expect(Math.abs(totalArea(result.mesh) - before)).toBeLessThan(1e-9);
      expect(hasIndexDegenerateFaces(result.mesh)).toBe(false);
    });

    it("never creates index-degenerate faces on interior Steiner cut", () => {
      const result = materializeCutStrokes(
        unitTriangle(),
        [stroke("i", [v(0.5, 0), v(0.25, 0.25)])],
        new Set(),
      );
      expect(hasIndexDegenerateFaces(result.mesh)).toBe(false);
      expect(maxEdgeIncidence(result.mesh)).toBeLessThanOrEqual(2);
    });

    it("every reported seam EdgeKey exists as a mesh edge", () => {
      const result = materializeCutStrokes(
        unitQuad(),
        [stroke("q", [v(0, 0.5), v(1, 0.5)])],
        new Set(),
      );
      expect(seamEdgesExistOnMesh(result.mesh, result.seams.seams)).toBe(true);
    });

    it("manifest edgeKeys are a subset of seams and exist on the mesh", () => {
      const result = materializeCutStrokes(
        unitTriangle(),
        [stroke("m", [v(0.5, 0), v(0.5, 0.5)])],
        new Set(),
      );
      for (const entry of result.manifest) {
        for (const key of entry.edgeKeys) {
          expect(result.seams.seams.has(key)).toBe(true);
        }
      }
      expect(seamEdgesExistOnMesh(result.mesh, result.seams.seams)).toBe(true);
    });

    it("closed cube cut remains manifold (edge incidence ≤ 2)", () => {
      // Horizontal cut across +Z face: from mid of bottom edge to mid of top edge
      const result = materializeCutStrokes(
        unitCube(),
        [stroke("face", [v(0, -0.5, 0.5), v(0, 0.5, 0.5)])],
        new Set(),
      );
      expect(hasIndexDegenerateFaces(result.mesh)).toBe(false);
      expect(maxEdgeIncidence(result.mesh)).toBeLessThanOrEqual(2);
      expect(seamEdgesExistOnMesh(result.mesh, result.seams.seams)).toBe(true);
    });
  });

  describe("multi-face / bridge connectivity", () => {
    it("cuts across shared diagonal of a quad (two faces)", () => {
      // From left boundary through both tris to right boundary
      const result = materializeCutStrokes(
        unitQuad(),
        [stroke("across", [v(0, 0.5), v(1, 0.5)])],
        new Set(),
      );
      expect(result.warnings.some((w) => w.includes("could not connect"))).toBe(
        false,
      );
      expect(result.seams.seams.size).toBeGreaterThanOrEqual(2);
      expect(seamEdgesExistOnMesh(result.mesh, result.seams.seams)).toBe(true);
      // Continuity: there should be a path of seam edges from left to right mid
      expect(result.manifest[0]!.edgeKeys.length).toBeGreaterThanOrEqual(1);
    });

    it("single segment spanning two adjacent faces via bridge split", () => {
      // Midpoints of opposite outer edges of the two-tri quad
      const result = materializeCutStrokes(
        unitQuad(),
        [stroke("bridge", [v(0.5, 0), v(0.5, 1)])],
        new Set(),
      );
      expect(result.warnings.some((w) => w.includes("could not connect"))).toBe(
        false,
      );
      expect(result.seams.seams.size).toBeGreaterThanOrEqual(1);
      expect(hasIndexDegenerateFaces(result.mesh)).toBe(false);
    });

    it("interior-to-interior multi-hop on one face produces continuous seams", () => {
      const result = materializeCutStrokes(
        unitTriangle(),
        [
          stroke("ii", [
            v(0.2, 0.15),
            v(0.35, 0.25),
            v(0.2, 0.35),
          ]),
        ],
        new Set(),
      );
      // All segments should connect; no silent skips
      expect(result.warnings.some((w) => w.includes("could not connect"))).toBe(
        false,
      );
      expect(result.warnings.some((w) => w.includes("lost surface"))).toBe(
        false,
      );
      for (const entry of result.manifest) {
        expect(entry.edgeKeys.length).toBeGreaterThanOrEqual(1);
      }
      expect(seamEdgesExistOnMesh(result.mesh, result.seams.seams)).toBe(true);
    });

    it("T-junction: second stroke endpoint snaps to first stroke interior vertex", () => {
      const s1 = stroke("stem", [v(0.5, 0), v(0.35, 0.35)]);
      const s2 = stroke("bar", [v(0.35, 0.35), v(0, 0.5)]);
      const result = materializeCutStrokes(unitTriangle(), [s1, s2], new Set());

      expect(result.warnings.some((w) => w.includes("could not connect"))).toBe(
        false,
      );
      expect(result.seams.seams.size).toBeGreaterThanOrEqual(2);
      expect(seamEdgesExistOnMesh(result.mesh, result.seams.seams)).toBe(true);

      // Shared T vertex should exist exactly once near (0.35,0.35)
      const eps = snapEpsilonForMesh(unitTriangle());
      let near = 0;
      for (let i = 0; i < result.mesh.vertexCount; i++) {
        if (distSq(readV(result.mesh, i), v(0.35, 0.35)) <= eps * eps) near++;
      }
      expect(near).toBe(1);
    });
  });

  describe("floating-point / snap / scale traps", () => {
    it("endpoint just outside snap eps is not silently welded to a far corner", () => {
      const mesh = unitTriangle();
      const eps = snapEpsilonForMesh(mesh);
      // Clearly off the vertex, on the edge
      const onEdge = v(10 * eps, 0);
      const result = materializeCutStrokes(
        mesh,
        [stroke("near", [onEdge, v(0.5, 0.5)])],
        new Set(),
      );
      const mid = findClosestVertex(result.mesh, onEdge);
      // Should NOT be vertex 0 if 10*eps > snap distance
      expect(mid).not.toBe(0);
      expect(distSq(readV(result.mesh, mid), onEdge)).toBeLessThanOrEqual(
        eps * eps * 4,
      );
    });

    it("tiny mesh (1e-6 scale) still locates face interiors", () => {
      const s = 1e-6;
      const mesh = makeMesh(
        [0, 0, 0, s, 0, 0, 0, s, 0],
        [0, 1, 2],
      );
      const result = materializeCutStrokes(
        mesh,
        [stroke("tiny", [v(s * 0.5, 0), v(s * 0.25, s * 0.25)])],
        new Set(),
      );
      // Should not report every endpoint as off-surface
      expect(
        result.warnings.some((w) => w.includes("not on mesh surface")),
      ).toBe(false);
      expect(result.mesh.faceCount).toBeGreaterThan(1);
    });

    it("huge mesh (1e6 scale) uses scale-aware snap without false off-surface", () => {
      const s = 1e6;
      const mesh = makeMesh(
        [0, 0, 0, s, 0, 0, 0, s, 0],
        [0, 1, 2],
      );
      const result = materializeCutStrokes(
        mesh,
        [stroke("huge", [v(s * 0.5, 0), v(s * 0.25, s * 0.25)])],
        new Set(),
      );
      expect(
        result.warnings.some((w) => w.includes("not on mesh surface")),
      ).toBe(false);
      expect(hasIndexDegenerateFaces(result.mesh)).toBe(false);
    });

    it("near-miss off-plane point within surface eps still materializes", () => {
      const result = materializeCutStrokes(
        unitTriangle(),
        [stroke("z", [v(0.5, 0, 5e-8), v(0.25, 0.25, 5e-8)])],
        new Set(),
      );
      expect(
        result.warnings.some((w) => w.includes("not on mesh surface")),
      ).toBe(false);
    });

    it("point farther off-plane than surface eps is rejected", () => {
      const result = materializeCutStrokes(
        unitTriangle(),
        [stroke("far", [v(0.5, 0, 0), v(0.25, 0.25, 2e-3)])],
        new Set(),
      );
      expect(
        result.warnings.some(
          (w) =>
            w.includes("not on mesh surface") || w.includes("lost surface"),
        ),
      ).toBe(true);
    });

    it("huge mesh must NOT accept an interior sample far off the plane", () => {
      const s = 1e6;
      const mesh = makeMesh([0, 0, 0, s, 0, 0, 0, s, 0], [0, 1, 2]);
      const offBy = 1e3;
      const result = materializeCutStrokes(
        mesh,
        [
          stroke("off", [
            v(s * 0.5, 0, 0),
            v(s * 0.25, s * 0.25, offBy),
          ]),
        ],
        new Set(),
      );
      expect(
        result.warnings.some(
          (w) =>
            w.includes("not on mesh surface") || w.includes("lost surface"),
        ),
      ).toBe(true);
    });

    it("relative snap epsilon subdivides distinct samples on tiny meshes", () => {
      const s = 1e-6;
      const mesh = makeMesh([0, 0, 0, s, 0, 0, 0, s, 0], [0, 1, 2]);
      const result = materializeCutStrokes(
        mesh,
        [stroke("tinyCut", [v(s * 0.5, 0), v(s * 0.25, s * 0.25)])],
        new Set(),
      );
      expect(result.mesh.faceCount).toBeGreaterThan(1);
      expect(result.seams.seams.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe("multi-face span limits (bridge heuristic)", () => {
    /** 2×2 grid of unit quads in XY (8 tris). */
    function grid2x2(): MeshModel {
      const verts: number[] = [];
      for (let y = 0; y <= 2; y++) {
        for (let x = 0; x <= 2; x++) {
          verts.push(x, y, 0);
        }
      }
      // Vertex index at (x,y) = y*3+x
      const faces: number[] = [];
      for (let y = 0; y < 2; y++) {
        for (let x = 0; x < 2; x++) {
          const i = y * 3 + x;
          faces.push(i, i + 1, i + 3 + 1, i, i + 3 + 1, i + 3);
        }
      }
      return makeMesh(verts, faces);
    }

    it("single segment crossing three or more faces should still connect", () => {
      // Left mid of grid to right mid — crosses two cell boundaries (≥3 tris)
      const result = materializeCutStrokes(
        grid2x2(),
        [stroke("long", [v(0, 1), v(2, 1)])],
        new Set(),
      );
      expect(result.warnings.some((w) => w.includes("could not connect"))).toBe(
        false,
      );
      expect(result.seams.seams.size).toBeGreaterThanOrEqual(2);
      expect(seamEdgesExistOnMesh(result.mesh, result.seams.seams)).toBe(true);
    });

    it("warns rather than inventing edges when endpoints are on disjoint faces", () => {
      // Opposite corners of the grid — one segment, many faces between
      const result = materializeCutStrokes(
        grid2x2(),
        [stroke("diag", [v(0.1, 0.1), v(1.9, 1.9)])],
        new Set(),
      );
      // Either fully connects with real seams, or skips with warning — never ghost keys
      expect(seamEdgesExistOnMesh(result.mesh, result.seams.seams)).toBe(true);
      expect(hasIndexDegenerateFaces(result.mesh)).toBe(false);
    });
  });

  describe("open-loop validation (ADR 0100)", () => {
    it("boundary-to-boundary cut on open triangle is NOT an open loop", () => {
      const result = materializeCutStrokes(
        unitTriangle(),
        [stroke("bb", [v(0.5, 0), v(0.5, 0.5)])],
        new Set(),
      );
      expect(result.validation.openLoops).toHaveLength(0);
    });

    it("closed polyline (first≈last) is never reported as open loop", () => {
      const result = materializeCutStrokes(
        unitTriangle(),
        [
          stroke("closed", [
            v(0.1, 0),
            v(0.3, 0.2),
            v(0.1, 0.3),
            v(0.1, 0),
          ]),
        ],
        new Set(),
      );
      expect(result.validation.openLoops).toHaveLength(0);
    });

    it("on a closed cube, edge-to-edge face cut is flagged open-loop (no mesh boundary)", () => {
      // ADR defines boundary via mesh boundary edges; closed solids have none.
      const result = materializeCutStrokes(
        unitCube(),
        [stroke("cube", [v(0, -0.5, 0.5), v(0, 0.5, 0.5)])],
        new Set(),
      );
      // Documented behavior: both endpoints fail isBoundaryVertex → open loop warning
      expect(result.validation.openLoops.length).toBeGreaterThanOrEqual(1);
      expect(result.warnings.some((w) => w.includes("open loop"))).toBe(true);
    });

    it("both endpoints interior → openLoops lists endpoints 0 and 1", () => {
      const result = materializeCutStrokes(
        unitTriangle(),
        [stroke("dart", [v(0.3, 0.2), v(0.2, 0.3)])],
        new Set(),
      );
      expect(result.validation.openLoops).toHaveLength(1);
      expect(result.validation.openLoops[0]!.interiorEndpoints).toEqual(
        expect.arrayContaining([0, 1]),
      );
    });
  });

  describe("manual seam remapping", () => {
    it("splitting a manual seam edge twice remaps to finest children only", () => {
      const mesh = unitTriangle();
      const manual = new Set([makeEdgeKey(0, 1)]);
      const result = materializeCutStrokes(
        mesh,
        [
          stroke("a", [v(1 / 3, 0), v(0.25, 0.25)]),
          stroke("b", [v(2 / 3, 0), v(0.4, 0.2)]),
        ],
        manual,
      );
      expect(result.seams.seams.has(makeEdgeKey(0, 1))).toBe(false);
      // Parent must not linger; all seam keys must be real edges
      expect(seamEdgesExistOnMesh(result.mesh, result.seams.seams)).toBe(true);
    });

    it("manual seams on untouched edges survive materialize", () => {
      const mesh = unitTriangle();
      const manual = new Set([makeEdgeKey(1, 2)]);
      const result = materializeCutStrokes(
        mesh,
        [stroke("cut", [v(0.5, 0), v(0.2, 0.2)])],
        manual,
      );
      expect(result.seams.seams.has(makeEdgeKey(1, 2))).toBe(true);
    });
  });

  describe("idempotence / purity", () => {
    it("does not mutate stroke point arrays", () => {
      const points = [v(0.5, 0), v(0.25, 0.25)];
      const frozen = points.map((p) => ({ ...p }));
      materializeCutStrokes(unitTriangle(), [stroke("p", points)], new Set());
      expect(points).toEqual(frozen);
    });

    it("same inputs produce identical seam key sets", () => {
      const mesh = unitQuad();
      const cuts = [stroke("c", [v(0, 0.5), v(1, 0.5)])];
      const a = materializeCutStrokes(mesh, cuts, new Set());
      const b = materializeCutStrokes(mesh, cuts, new Set());
      expect([...a.seams.seams].sort()).toEqual([...b.seams.seams].sort());
      expect(a.mesh.faceCount).toBe(b.mesh.faceCount);
      expect(a.mesh.vertexCount).toBe(b.mesh.vertexCount);
    });
  });

  describe("pathological meshes", () => {
    it("zero-area collinear triangle does not throw", () => {
      const mesh = makeMesh([0, 0, 0, 1, 0, 0, 0.5, 0, 0], [0, 1, 2]);
      expect(() =>
        materializeCutStrokes(
          mesh,
          [stroke("col", [v(0.25, 0), v(0.75, 0)])],
          new Set(),
        ),
      ).not.toThrow();
    });

    it("duplicate coplanar faces (non-manifold) do not crash", () => {
      const mesh = makeMesh(
        [0, 0, 0, 1, 0, 0, 0, 1, 0],
        [0, 1, 2, 0, 1, 2],
      );
      expect(() =>
        materializeCutStrokes(
          mesh,
          [stroke("nm", [v(0.5, 0), v(0.25, 0.25)])],
          new Set(),
        ),
      ).not.toThrow();
    });
  });
});

describe("QA audit: WorkingMesh helpers", () => {
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
    expect(wm.faces.length).toBe(before + 2); // 1 replaced by 3 → +2
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
    // After first split, edge 0-1 is gone; second call should find bridge
    expect(m1).not.toBe(m2);
    expect(wm.hasEdge(0, m1) || wm.hasEdge(0, m2)).toBe(true);
    // Original edge must not remain
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
});
