import { beforeEach, describe, expect, it } from "vitest";
import { buildTopology } from "../mesh/buildTopology";
import { createSeamRegistry } from "../seams/seamRegistry";
import { countQualityIssues } from "../unfold/qualitySummary";
import {
  useMeshSessionStore,
  type MeshSession,
} from "../../state/meshSessionStore";
import {
  appendPolylineDraftPoint,
  canPickCommittedStroke,
  writePlacedTwin,
} from "../../viewer/cutPolyline/cutPolylineHelpers";
import { tessellateDraftDisplayPath } from "../../viewer/cutPolyline/tessellateDraftDisplayPath";
import type { DisplayNormalization } from "../../viewer/displayNormalization";
import { flattenWithCutStrokes } from "./flattenWithCutStrokes";
import { stroke, unitQuad, v } from "./cutTestFixtures";
import type { CutStroke, Vec3 } from "./types";

const IDENTITY_NORM: DisplayNormalization = {
  centerX: 0,
  centerY: 0,
  centerZ: 0,
  scale: 1,
};

/** Closed square spanning both unitQuad tris (crosses diagonal). */
function multiFaceClosedLoop(id = "edit-me"): CutStroke {
  return stroke(id, [
    v(0.2, 0.2),
    v(0.8, 0.2),
    v(0.8, 0.8),
    v(0.2, 0.8),
    v(0.2, 0.2),
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

function flattenIslands(strokes: readonly CutStroke[]): number {
  const mesh = unitQuad();
  const result = flattenWithCutStrokes({
    mesh,
    topology: buildTopology(mesh),
    seams: createSeamRegistry(),
    cutStrokes: strokes,
  });
  expect(result.unfold.error).toBeUndefined();
  return result.unfold.islands.length;
}

function cloneStroke(s: CutStroke): CutStroke {
  return {
    id: s.id,
    points: s.points.map((p) => ({ x: p.x, y: p.y, z: p.z })),
  };
}

describe("Slice D committed re-edit (characterizing)", () => {
  describe("append is strictly at the end", () => {
    it("keeps the existing prefix and only grows the tail", () => {
      const original: Vec3[] = [v(0.2, 0.2), v(0.8, 0.2), v(0.8, 0.8)];
      const display = original.map((p) => ({ ...p }));
      const canonical = original.map((p) => ({ ...p }));
      const result = appendPolylineDraftPoint(
        display,
        canonical,
        { x: 0.2, y: 0.8, z: 0 },
        IDENTITY_NORM,
      );
      expect(result.status).toBe("added");
      if (result.status !== "added") return;
      expect(result.canonical).toHaveLength(4);
      expect(result.canonical.slice(0, 3)).toEqual(original);
      expect(result.canonical[3]).toEqual({ x: 0.2, y: 0.8, z: 0 });
      expect(original).toHaveLength(3);
    });

    it("does not insert between existing vertices (no mid-segment splice)", () => {
      const canonical = [v(0, 0), v(1, 0), v(1, 1)];
      const display = canonical.map((p) => ({ ...p }));
      const result = appendPolylineDraftPoint(
        display,
        canonical,
        { x: 0.5, y: 0, z: 0 },
        IDENTITY_NORM,
      );
      expect(result.status).toBe("added");
      if (result.status !== "added") return;
      expect(result.canonical.map((p) => [p.x, p.y, p.z])).toEqual([
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0],
        [0.5, 0, 0],
      ]);
    });
  });

  describe("committed-stroke pick while editing (viewer gate)", () => {
    it("canPickCommittedStroke is false in editingCommitted so other strokes are not pickable (POLYCUT-D-001)", () => {
      expect(canPickCommittedStroke(true, "editing-id", false)).toBe(false);
    });
  });

  describe("marker drag updates the path without touching the store copy", () => {
    it("writePlacedTwin + retessellate mutates only the edit clones", () => {
      const stored = multiFaceClosedLoop();
      const display = stored.points.map((p) => ({ ...p }));
      const canonical = stored.points.map((p) => ({ ...p }));
      const beforeStore = cloneStroke(stored);

      writePlacedTwin(
        display,
        canonical,
        1,
        { x: 0.7, y: 0.25, z: 0 },
        IDENTITY_NORM,
        true,
      );

      expect(stored.points).toEqual(beforeStore.points);
      expect(canonical[1]).toEqual({ x: 0.7, y: 0.25, z: 0 });
      expect(display[1]).toEqual({ x: 0.7, y: 0.25, z: 0 });

      const line = tessellateDraftDisplayPath(
        unitQuad(),
        canonical,
        null,
        IDENTITY_NORM,
      );
      expect(line.length).toBeGreaterThanOrEqual(canonical.length - 1);
      const moved = line.some(
        (p) => Math.abs(p.x - 0.7) < 1e-5 && Math.abs(p.y - 0.25) < 1e-5,
      );
      expect(moved).toBe(true);
    });
  });

  describe("cancel vs commit against Zustand", () => {
    beforeEach(() => {
      useMeshSessionStore.setState({
        session: quadSession(),
        meshLoadVersion: 1,
        cutStrokes: [],
        patternRevision: 0,
      });
    });

    it("cancel (no updateCutStroke) leaves the original stroke and revision", () => {
      const original = multiFaceClosedLoop();
      useMeshSessionStore.getState().addCutStroke(original);
      const rev = useMeshSessionStore.getState().patternRevision;
      const edit = cloneStroke(useMeshSessionStore.getState().cutStrokes[0]!);
      edit.points[1] = v(0.7, 0.25);
      // Esc / Cancel: drop the clone, never call updateCutStroke.
      const stored = useMeshSessionStore.getState().cutStrokes[0]!;
      expect(stored.points[1]).toEqual(v(0.8, 0.2));
      expect(useMeshSessionStore.getState().patternRevision).toBe(rev);
    });

    it("Done/updateCutStroke replaces points, bumps patternRevision, not meshLoadVersion", () => {
      const original = multiFaceClosedLoop();
      useMeshSessionStore.getState().addCutStroke(original);
      const load = useMeshSessionStore.getState().meshLoadVersion;
      const rev = useMeshSessionStore.getState().patternRevision;
      const next = original.points.map((p) => ({ ...p }));
      next[1] = v(0.7, 0.25);
      useMeshSessionStore.getState().updateCutStroke(original.id, next);
      const stored = useMeshSessionStore.getState().cutStrokes[0]!;
      expect(stored.points[1]).toEqual(v(0.7, 0.25));
      expect(useMeshSessionStore.getState().patternRevision).toBe(rev + 1);
      expect(useMeshSessionStore.getState().meshLoadVersion).toBe(load);
    });
  });

  describe("Flatten after commit", () => {
    it("committed closed loop splits islands; cancel-equivalent original still splits", () => {
      const original = multiFaceClosedLoop();
      expect(flattenIslands([original])).toBeGreaterThanOrEqual(2);
    });

    it("after updateCutStroke to an interior dart, Flatten island count can change", () => {
      const closed = multiFaceClosedLoop();
      const before = flattenIslands([closed]);
      const openDart = stroke("edit-me", [v(0.3, 0.2), v(0.3, 0.5)]);
      const after = flattenWithCutStrokes({
        mesh: unitQuad(),
        topology: buildTopology(unitQuad()),
        seams: createSeamRegistry(),
        cutStrokes: [openDart],
      });
      expect(after.unfold.error).toBeUndefined();
      expect(after.unfold.islands.length).toBeLessThanOrEqual(before);
      expect(after.openLoops.length).toBeGreaterThanOrEqual(1);
    });

    it("append-at-end then Flatten uses the longer polyline (still ≥2 islands if closed after append+close)", () => {
      const open = stroke("edit-me", [
        v(0.2, 0.2),
        v(0.8, 0.2),
        v(0.8, 0.8),
        v(0.2, 0.8),
      ]);
      const display = open.points.map((p) => ({ ...p }));
      const canonical = open.points.map((p) => ({ ...p }));
      const appended = appendPolylineDraftPoint(
        display,
        canonical,
        { x: 0.2, y: 0.2, z: 0 },
        IDENTITY_NORM,
      );
      expect(appended.status).toBe("added");
      if (appended.status !== "added") return;
      const result = flattenWithCutStrokes({
        mesh: unitQuad(),
        topology: buildTopology(unitQuad()),
        seams: createSeamRegistry(),
        cutStrokes: [stroke("edit-me", appended.canonical)],
      });
      expect(result.unfold.error).toBeUndefined();
      expect(result.unfold.islands.length).toBeGreaterThanOrEqual(2);
      expect(countQualityIssues(result.unfold).collisionCount).toBe(0);
    });
  });
});
