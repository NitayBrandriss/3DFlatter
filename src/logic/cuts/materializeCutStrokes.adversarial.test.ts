import { describe, expect, it } from "vitest";
import { makeEdgeKey } from "../mesh/edgeKey";
import type { MeshModel } from "../mesh/types";
import {
  findClosestVertex,
  makeMesh,
  readV,
  stroke,
  unitCube,
  unitQuad,
  unitTriangle,
  v,
} from "./cutTestFixtures";
import {
  hasIndexDegenerateFaces,
  maxEdgeIncidence,
  seamEdgesExistOnMesh,
  totalArea,
} from "./cutTestAssertions";
import { materializeCutStrokes } from "./materializeCutStrokes";
import { distSq, snapEpsilonForMesh } from "./vec3";

describe("materializeCutStrokes adversarial", () => {
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
          stroke("ok", [v(0.1, 0), v(0.3, 0.2), v(0.5, 0.05)]),
        ],
        new Set(),
      );
      expect(result.warnings.some((w) => w.includes("self-intersecting"))).toBe(
        false,
      );
    });

    it("closed square loop on a face is not flagged as self-intersecting", () => {
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
      expect(result.warnings.some((w) => w.includes("self-intersecting"))).toBe(
        true,
      );
    });

    it("rejects open 4-point bowtie (first segment vs last — closed-stroke exclusion trap)", () => {
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
      const result = materializeCutStrokes(
        unitTriangle(),
        [
          stroke("midX", [
            v(0.05, 0.02),
            v(0.2, 0.05),
            v(0.65, 0.35),
            v(0.5, 0.08),
            v(0.1, 0.35),
            v(0.15, 0.1),
          ]),
        ],
        new Set(),
      );
      expect(result.warnings.some((w) => w.includes("self-intersecting"))).toBe(
        true,
      );
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
      expect(result.manifest[0]!.edgeKeys.length).toBeGreaterThanOrEqual(1);
    });

    it("single segment spanning two adjacent faces via bridge split", () => {
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
          stroke("ii", [v(0.2, 0.15), v(0.35, 0.25), v(0.2, 0.35)]),
        ],
        new Set(),
      );
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
      const onEdge = v(10 * eps, 0);
      const result = materializeCutStrokes(
        mesh,
        [stroke("near", [onEdge, v(0.5, 0.5)])],
        new Set(),
      );
      const mid = findClosestVertex(result.mesh, onEdge);
      expect(mid).not.toBe(0);
      expect(distSq(readV(result.mesh, mid), onEdge)).toBeLessThanOrEqual(
        eps * eps * 4,
      );
    });

    it("tiny mesh (1e-6 scale) still locates face interiors", () => {
      const s = 1e-6;
      const mesh = makeMesh([0, 0, 0, s, 0, 0, 0, s, 0], [0, 1, 2]);
      const result = materializeCutStrokes(
        mesh,
        [stroke("tiny", [v(s * 0.5, 0), v(s * 0.25, s * 0.25)])],
        new Set(),
      );
      expect(
        result.warnings.some((w) => w.includes("not on mesh surface")),
      ).toBe(false);
      expect(result.mesh.faceCount).toBeGreaterThan(1);
    });

    it("huge mesh (1e6 scale) uses scale-aware snap without false off-surface", () => {
      const s = 1e6;
      const mesh = makeMesh([0, 0, 0, s, 0, 0, 0, s, 0], [0, 1, 2]);
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
          stroke("off", [v(s * 0.5, 0, 0), v(s * 0.25, s * 0.25, offBy)]),
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
    function grid2x2(): MeshModel {
      const verts: number[] = [];
      for (let y = 0; y <= 2; y++) {
        for (let x = 0; x <= 2; x++) {
          verts.push(x, y, 0);
        }
      }
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
      const result = materializeCutStrokes(
        grid2x2(),
        [stroke("diag", [v(0.1, 0.1), v(1.9, 1.9)])],
        new Set(),
      );
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
      const result = materializeCutStrokes(
        unitCube(),
        [stroke("cube", [v(0, -0.5, 0.5), v(0, 0.5, 0.5)])],
        new Set(),
      );
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
