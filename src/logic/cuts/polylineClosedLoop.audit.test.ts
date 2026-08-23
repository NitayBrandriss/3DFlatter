import { beforeEach, describe, expect, it } from "vitest";
import { buildTopology } from "../mesh/buildTopology";
import { partitionIslands } from "../mesh/partitionIslands";
import { createSeamRegistry } from "../seams/seamRegistry";
import { countQualityIssues } from "../unfold/qualitySummary";
import {
  computeSessionStats,
  useMeshSessionStore,
  type MeshSession,
} from "../../state/meshSessionStore";
import { closePolylineByDuplicatingFirst } from "../../viewer/cutPolyline/cutPolylineHelpers";
import { makeMesh, stroke, foldedDihedralQuad, unitCube, unitQuad, v, singleFaceClosedLoop } from "./cutTestFixtures";
import { flattenWithCutStrokes } from "./flattenWithCutStrokes";
import { materializeCutStrokes } from "./materializeCutStrokes";

/**
 * Historical POLYCUT-B characterizing IDs (P0-B01/B02/…).
 * Production closed-loop flatten/soup contracts: flattenWithCutStrokes.test.ts
 * and materializeCutStrokes.test.ts. Do not delete these describe titles —
 * they are cited in qa-audits.md.
 */

/** Closed square spanning both unitQuad tris (crosses diagonal 0–2). */
function multiFaceClosedLoop() {
  return stroke("multi-face", [
    v(0.2, 0.2),
    v(0.8, 0.2),
    v(0.8, 0.8),
    v(0.2, 0.8),
    v(0.2, 0.2),
  ]);
}

/** Closed loop spanning both wings of foldedDihedralQuad (90° dihedral). */
function foldedDihedralClosedLoop() {
  return stroke("folded-dihedral", [
    v(0.3, 0.2, 0),
    v(0, 0.2, 0.3),
    v(0, 0.4, 0.3),
    v(0.3, 0.4, 0),
    v(0.3, 0.2, 0),
  ]);
}

function quadSession(): MeshSession {
  const mesh = unitQuad();
  return {
    mesh,
    topology: buildTopology(mesh),
    seams: createSeamRegistry(),
    fileName: "quad.obj",
  };
}

describe("POLYCUT-B closed-loop characterizing (P0-B01/B02/B02b/B03)", () => {
  describe("P0-B02 — single-face closed loop splits on Flatten", () => {
    it("yields ≥2 islands and zero quality overlaps", () => {
      const mesh = unitQuad();
      const topology = buildTopology(mesh);
      const result = flattenWithCutStrokes({
        mesh,
        topology,
        seams: createSeamRegistry(),
        cutStrokes: [singleFaceClosedLoop()],
      });

      expect(result.unfold.error).toBeUndefined();
      expect(result.openLoops).toEqual([]);
      expect(result.unfold.islands.length).toBeGreaterThanOrEqual(2);
      expect(countQualityIssues(result.unfold).collisionCount).toBe(0);
    });
  });

  describe("P0-B02b — multi-face closed loop (crosses unitQuad diagonal)", () => {
    it("yields ≥2 islands and zero quality overlaps (POLYCUT-B-002)", () => {
      const mesh = unitQuad();
      const topology = buildTopology(mesh);
      const result = flattenWithCutStrokes({
        mesh,
        topology,
        seams: createSeamRegistry(),
        cutStrokes: [multiFaceClosedLoop()],
      });

      expect(result.unfold.error).toBeUndefined();
      expect(result.openLoops).toEqual([]);
      expect(result.unfold.islands.length).toBeGreaterThanOrEqual(2);
      expect(countQualityIssues(result.unfold).collisionCount).toBe(0);
    });

    it("materialize island partition also ≥2 after multi-face closed loop", () => {
      const mesh = unitQuad();
      const mat = materializeCutStrokes(mesh, [multiFaceClosedLoop()], new Set());
      const islands = partitionIslands(mat.mesh, mat.topology, mat.seams);
      expect(islands.length).toBeGreaterThanOrEqual(2);
    });

    it("2x2 grid closed loop spanning many faces splits without overlaps", () => {
      // 3x3 verts → 8 tris; loop around center crosses many shared edges.
      const mesh = makeMesh(
        [
          0, 0, 0, 0.5, 0, 0, 1, 0, 0, 0, 0.5, 0, 0.5, 0.5, 0, 1, 0.5, 0, 0, 1,
          0, 0.5, 1, 0, 1, 1, 0,
        ],
        [
          0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 3, 4, 7, 3, 7, 6, 4, 5, 8, 4, 8,
          7,
        ],
      );
      const topology = buildTopology(mesh);
      const loop = stroke("grid-loop", [
        v(0.25, 0.25),
        v(0.75, 0.25),
        v(0.75, 0.75),
        v(0.25, 0.75),
        v(0.25, 0.25),
      ]);
      const result = flattenWithCutStrokes({
        mesh,
        topology,
        seams: createSeamRegistry(),
        cutStrokes: [loop],
      });
      expect(result.unfold.error).toBeUndefined();
      expect(result.unfold.islands.length).toBeGreaterThanOrEqual(2);
      expect(countQualityIssues(result.unfold).collisionCount).toBe(0);
    });

    it("closed loop on one cube face (2 tris) splits without overlaps", () => {
      const mesh = unitCube();
      const topology = buildTopology(mesh);
      const loop = stroke("cube-face", [
        v(-0.2, -0.2, 0.5),
        v(0.2, -0.2, 0.5),
        v(0.2, 0.2, 0.5),
        v(-0.2, 0.2, 0.5),
        v(-0.2, -0.2, 0.5),
      ]);
      const result = flattenWithCutStrokes({
        mesh,
        topology,
        seams: createSeamRegistry(),
        cutStrokes: [loop],
      });
      expect(result.unfold.error).toBeUndefined();
      expect(
        result.materializeWarnings.filter((w) =>
          w.includes("could not connect"),
        ),
      ).toEqual([]);
      expect(result.unfold.islands.length).toBeGreaterThanOrEqual(2);
      expect(countQualityIssues(result.unfold).collisionCount).toBe(0);
    });
  });

  describe("P0-B02c — folded dihedral closed loop (90° shared edge)", () => {
    it("yields ≥2 islands, zero overlaps, no connect-skip warning (POLYCUT-B-002 dihedral)", () => {
      const mesh = foldedDihedralQuad();
      const topology = buildTopology(mesh);
      const result = flattenWithCutStrokes({
        mesh,
        topology,
        seams: createSeamRegistry(),
        cutStrokes: [foldedDihedralClosedLoop()],
      });

      expect(result.unfold.error).toBeUndefined();
      expect(result.openLoops).toEqual([]);
      expect(
        result.materializeWarnings.filter((w) =>
          w.includes("could not connect"),
        ),
      ).toEqual([]);
      expect(
        result.materializeWarnings.filter((w) =>
          w.includes("did not increase island count"),
        ),
      ).toEqual([]);
      expect(result.unfold.islands.length).toBeGreaterThanOrEqual(2);
      expect(countQualityIssues(result.unfold).collisionCount).toBe(0);
    });

    it("materialize island partition also ≥2 after folded dihedral closed loop", () => {
      const mesh = foldedDihedralQuad();
      const mat = materializeCutStrokes(mesh, [foldedDihedralClosedLoop()], new Set());
      expect(
        mat.warnings.filter((w) => w.includes("could not connect")),
      ).toEqual([]);
      expect(mat.manifest.every((m) => m.edgeKeys.length > 0)).toBe(true);
      const islands = partitionIslands(mat.mesh, mat.topology, mat.seams);
      expect(islands.length).toBeGreaterThanOrEqual(2);
      expect(mat.seams.seams.size).toBeGreaterThan(0);
    });
  });

  describe("P0-B01 — session stats ignore cut strokes", () => {
    beforeEach(() => {
      useMeshSessionStore.setState({
        session: null,
        meshLoadVersion: 0,
        cutStrokes: [],
        patternRevision: 0,
        isLoading: false,
        error: null,
        meshEditTool: "cut",
        toasts: [],
        toastSeq: 0,
      });
    });

    it("islandCount unchanged after adding a closed cut stroke", () => {
      const session = quadSession();
      useMeshSessionStore.setState({ session, meshLoadVersion: 1 });
      const before = computeSessionStats(session)!.islandCount;

      useMeshSessionStore.getState().addCutStroke(multiFaceClosedLoop());
      const afterSession = useMeshSessionStore.getState().session!;
      const after = computeSessionStats(afterSession)!.islandCount;

      expect(useMeshSessionStore.getState().cutStrokes).toHaveLength(1);
      expect(after).toBe(before);
    });
  });

  describe("P0-B03 — marker-close closedness", () => {
    it("closePolylineByDuplicatingFirst yields first≈last and not open-loop", () => {
      const open = [
        v(0.2, 0.2),
        v(0.8, 0.2),
        v(0.8, 0.8),
        v(0.2, 0.8),
      ];
      const closed = closePolylineByDuplicatingFirst(open, open);
      expect(closed).not.toBeNull();
      expect(closed!.canonical).toHaveLength(5);
      expect(closed!.canonical[0]).toEqual(closed!.canonical[4]);

      const mat = materializeCutStrokes(
        unitQuad(),
        [stroke("closed", closed!.canonical)],
        new Set(),
      );
      expect(mat.validation.openLoops).toEqual([]);
    });
  });

  describe("POLYCUT-B-004 — closed-but-gapped warning", () => {
    it("warns when a closed stroke has a collapsed segment (empty edgeKeys)", () => {
      const mat = materializeCutStrokes(
        unitQuad(),
        [
          stroke("gapped", [
            v(0.2, 0.2),
            v(0.8, 0.2),
            v(0.8, 0.2), // collapsed segment
            v(0.8, 0.8),
            v(0.2, 0.8),
            v(0.2, 0.2),
          ]),
        ],
        new Set(),
      );
      expect(
        mat.warnings.some((w) => w.includes("gapped seam cycle")),
      ).toBe(true);
    });
  });
});
