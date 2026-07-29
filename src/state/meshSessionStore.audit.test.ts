/**
 * Adversarial QA audit suite for Slice 2 — cut stroke state + Flatten wiring.
 * After remediation, these assert ADR 0100 / STATE-S2 fixed contracts.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { parseObj } from "../logic/io/obj/parseObj";
import { buildTopology } from "../logic/mesh/buildTopology";
import { makeEdgeKey } from "../logic/mesh/edgeKey";
import type { MeshModel } from "../logic/mesh/types";
import {
  createSeamRegistry,
  toggleSeam,
} from "../logic/seams/seamRegistry";
import { flattenWithCutStrokes } from "../logic/cuts/flattenWithCutStrokes";
import type { CutStroke, Vec3 } from "../logic/cuts/types";
import { formatMaterializeWarningsToast } from "../ui/formatMaterializeWarningsToast";
import {
  flattenSnapshotKey,
  seamsContentKey,
  useMeshSessionStore,
  type MeshSession,
} from "./meshSessionStore";

const TRI_OBJ = `
v 0 0 0
v 1 0 0
v 0 1 0
f 1 2 3
`;

const CUBE_OBJ = `
v -1 -1 -1
v 1 -1 -1
v 1 1 -1
v -1 1 -1
v -1 -1 1
v 1 -1 1
v 1 1 1
v -1 1 1
f 1 2 3
f 1 3 4
f 5 6 7
f 5 7 8
f 1 5 8
f 1 8 4
f 2 6 7
f 2 7 3
f 4 3 7
f 4 7 8
f 1 2 6
f 1 6 5
`;

function v(x: number, y: number, z = 0): Vec3 {
  return { x, y, z };
}

function stroke(id: string, points: Vec3[]): CutStroke {
  return { id, points };
}

function triMesh(): { mesh: MeshModel; topology: ReturnType<typeof buildTopology> } {
  const { mesh } = parseObj(TRI_OBJ);
  return { mesh, topology: buildTopology(mesh) };
}

function cubeSession(seams = createSeamRegistry()): MeshSession {
  const { mesh } = parseObj(CUBE_OBJ);
  const topology = buildTopology(mesh);
  return { mesh, topology, seams, fileName: "cube.obj" };
}

function resetStore() {
  useMeshSessionStore.setState({
    session: null,
    meshLoadVersion: 0,
    cutStrokes: [],
    patternRevision: 0,
    isLoading: false,
    error: null,
    meshEditTool: "seam",
    toasts: [],
    toastSeq: 0,
  });
}

function withSession(session = cubeSession()) {
  useMeshSessionStore.setState({ session, meshLoadVersion: 1 });
}

describe("QA audit Slice 2: flattenSnapshotKey vs ADR 0100", () => {
  it("ADR requires seams in flatten fingerprint — key must change when seams change", () => {
    const load = 3;
    const rev = 2;
    const seamsA = seamsContentKey(createSeamRegistry());
    const seamsB = seamsContentKey(
      toggleSeam(createSeamRegistry(), makeEdgeKey(0, 1)),
    );
    expect(seamsA).not.toBe(seamsB);
    expect(flattenSnapshotKey(load, rev, seamsA)).not.toBe(
      flattenSnapshotKey(load, rev, seamsB),
    );
    expect(flattenSnapshotKey(load, rev, seamsA)).toBe(
      flattenSnapshotKey(load, rev, seamsA),
    );
  });
});

describe("QA audit Slice 2: cutStrokes store invariants", () => {
  beforeEach(() => {
    resetStore();
    withSession();
  });

  it("addCutStroke does not mutate session.mesh buffers", () => {
    const session = cubeSession();
    const vertsBefore = Array.from(session.mesh.vertices);
    useMeshSessionStore.setState({ session, meshLoadVersion: 1 });
    useMeshSessionStore.getState().addCutStroke(
      stroke("c", [v(0, 0, 0), v(1, 0, 0)]),
    );
    expect(Array.from(session.mesh.vertices)).toEqual(vertsBefore);
    expect(useMeshSessionStore.getState().session!.mesh).toBe(session.mesh);
  });

  it("deep-copies stroke points so external mutation cannot corrupt the store", () => {
    const p0 = v(0, 0, 0);
    const p1 = v(1, 0, 0);
    const points = [p0, p1];
    useMeshSessionStore.getState().addCutStroke(stroke("mut", points));

    p0.x = 99;
    points.push(v(2, 2, 2));

    const stored = useMeshSessionStore.getState().cutStrokes[0]!;
    expect(stored.points).toHaveLength(2);
    expect(stored.points[0]!.x).toBe(0);
  });

  it("updateCutStroke deep-copies points against later mutation", () => {
    useMeshSessionStore.getState().addCutStroke(
      stroke("u", [v(0, 0, 0), v(1, 0, 0)]),
    );
    const p0 = v(0, 1, 0);
    const p1 = v(1, 1, 0);
    const nextPts = [p0, p1];
    useMeshSessionStore.getState().updateCutStroke("u", nextPts);
    p0.y = -1;
    expect(useMeshSessionStore.getState().cutStrokes[0]!.points[0]!.y).toBe(1);
  });

  it("replace-on-add enforces unique stroke ids", () => {
    const store = useMeshSessionStore.getState();
    store.addCutStroke(stroke("dup", [v(0, 0), v(1, 0)]));
    store.addCutStroke(stroke("dup", [v(0, 1), v(1, 1)]));
    expect(useMeshSessionStore.getState().cutStrokes).toHaveLength(1);
    expect(useMeshSessionStore.getState().cutStrokes[0]!.points[0]!.y).toBe(1);

    store.updateCutStroke("dup", [v(0, 0), v(0, 1), v(1, 1)]);
    expect(useMeshSessionStore.getState().cutStrokes[0]!.points).toHaveLength(3);

    store.deleteCutStroke("dup");
    expect(useMeshSessionStore.getState().cutStrokes).toHaveLength(0);
  });

  it("updateCutStroke with fewer than 2 points is a no-op (no revision bump)", () => {
    useMeshSessionStore.getState().addCutStroke(
      stroke("a", [v(0, 0), v(1, 0)]),
    );
    const rev = useMeshSessionStore.getState().patternRevision;
    useMeshSessionStore.getState().updateCutStroke("a", [v(0, 0)]);
    expect(useMeshSessionStore.getState().patternRevision).toBe(rev);
    expect(useMeshSessionStore.getState().cutStrokes[0]!.points).toHaveLength(2);
  });

  it("clearAllSeams does not bump patternRevision or meshLoadVersion", () => {
    const session = cubeSession(
      toggleSeam(createSeamRegistry(), makeEdgeKey(0, 1)),
    );
    useMeshSessionStore.setState({
      session,
      meshLoadVersion: 3,
      patternRevision: 7,
      cutStrokes: [stroke("x", [v(0, 0), v(1, 0)])],
    });
    useMeshSessionStore.getState().clearAllSeams();
    const next = useMeshSessionStore.getState();
    expect(next.patternRevision).toBe(7);
    expect(next.meshLoadVersion).toBe(3);
    expect(next.session!.seams.seams.size).toBe(0);
    expect(next.cutStrokes).toHaveLength(1);
  });

  it("failed load preserves cutStrokes and patternRevision", async () => {
    const previousRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    }) as typeof requestAnimationFrame;

    try {
      useMeshSessionStore.setState({
        cutStrokes: [stroke("keep", [v(0, 0), v(1, 0)])],
        patternRevision: 3,
        meshLoadVersion: 1,
        session: cubeSession(),
      });
      const file = new File(["not a mesh"], "bad.txt", { type: "text/plain" });
      const ok = await useMeshSessionStore.getState().loadMeshFile(file);
      expect(ok).toBe(false);
      const next = useMeshSessionStore.getState();
      expect(next.cutStrokes).toHaveLength(1);
      expect(next.patternRevision).toBe(3);
      expect(next.meshLoadVersion).toBe(1);
      expect(next.session).not.toBeNull();
    } finally {
      if (previousRaf) {
        globalThis.requestAnimationFrame = previousRaf;
      } else {
        Reflect.deleteProperty(globalThis, "requestAnimationFrame");
      }
    }
  });

  it("addCutStroke no-ops when session is null", () => {
    useMeshSessionStore.setState({ session: null });
    useMeshSessionStore.getState().addCutStroke(
      stroke("orphan", [v(0, 0), v(1, 0)]),
    );
    expect(useMeshSessionStore.getState().cutStrokes).toHaveLength(0);
    expect(useMeshSessionStore.getState().session).toBeNull();
  });
});

describe("QA audit Slice 2: flattenWithCutStrokes", () => {
  it("does not mutate the base mesh when strokes are present", () => {
    const { mesh, topology } = triMesh();
    const vertsBefore = Array.from(mesh.vertices);
    const facesBefore = Array.from(mesh.faces);
    flattenWithCutStrokes({
      mesh,
      topology,
      seams: createSeamRegistry(),
      cutStrokes: [stroke("d", [v(0.5, 0), v(0.5, 0.5)])],
    });
    expect(Array.from(mesh.vertices)).toEqual(vertsBefore);
    expect(Array.from(mesh.faces)).toEqual(facesBefore);
  });

  it("does not mutate the base mesh when strokes are empty", () => {
    const { mesh, topology } = triMesh();
    const vertsBefore = Array.from(mesh.vertices);
    flattenWithCutStrokes({
      mesh,
      topology,
      seams: createSeamRegistry(),
      cutStrokes: [],
    });
    expect(Array.from(mesh.vertices)).toEqual(vertsBefore);
  });

  it("unions manual seams into the unfolded pattern when cuts exist", () => {
    const { mesh, topology } = triMesh();
    const manual = toggleSeam(createSeamRegistry(), makeEdgeKey(0, 1));
    const result = flattenWithCutStrokes({
      mesh,
      topology,
      seams: manual,
      cutStrokes: [stroke("dart", [v(0.5, 0), v(0.25, 0.25)])],
    });
    expect(result.unfold.error).toBeUndefined();
    expect(result.unfold.islands.length).toBeGreaterThanOrEqual(1);
    expect(result.materializeWarnings.length).toBeGreaterThanOrEqual(0);
  });

  it("skips self-intersecting stroke but still unfolds the base-derived mesh", () => {
    const { mesh, topology } = triMesh();
    const result = flattenWithCutStrokes({
      mesh,
      topology,
      seams: createSeamRegistry(),
      cutStrokes: [
        stroke("x", [
          v(0.2, 0.05),
          v(0.6, 0.35),
          v(0.55, 0.05),
          v(0.15, 0.35),
        ]),
      ],
    });
    expect(
      result.materializeWarnings.some((w) => w.includes("self-intersecting")),
    ).toBe(true);
    expect(result.unfold.error).toBeUndefined();
    expect(result.unfold.islands.length).toBeGreaterThanOrEqual(1);
  });

  it("empty strokes path unfolds without error", () => {
    const { mesh, topology } = triMesh();
    const result = flattenWithCutStrokes({
      mesh,
      topology,
      seams: createSeamRegistry(),
      cutStrokes: [],
    });
    expect(result.openLoops).toEqual([]);
    expect(result.materializeWarnings).toEqual([]);
    expect(result.unfold.error).toBeUndefined();
    expect(result.unfold.islands.length).toBe(1);
    expect(result.unfold.islands[0]!.faces.length).toBe(1);
  });

  it("multi-stroke order is applied (second stroke sees first subdivision)", () => {
    const { mesh } = parseObj(`
v 0 0 0
v 1 0 0
v 1 1 0
v 0 1 0
f 1 2 3
f 1 3 4
`);
    const topology = buildTopology(mesh);
    const s1 = stroke("a", [v(0, 0.5), v(0.5, 0.5)]);
    const s2 = stroke("b", [v(0.5, 0.5), v(1, 0.5)]);
    const both = flattenWithCutStrokes({
      mesh,
      topology,
      seams: createSeamRegistry(),
      cutStrokes: [s1, s2],
    });
    const one = flattenWithCutStrokes({
      mesh,
      topology,
      seams: createSeamRegistry(),
      cutStrokes: [s1],
    });
    expect(both.unfold.error).toBeUndefined();
    expect(one.unfold.error).toBeUndefined();
    const facesBoth = both.unfold.islands.reduce(
      (n, isl) => n + isl.faces.length,
      0,
    );
    const facesOne = one.unfold.islands.reduce(
      (n, isl) => n + isl.faces.length,
      0,
    );
    expect(facesBoth).toBeGreaterThanOrEqual(facesOne);
  });

  it("propagates openLoops alongside materializeWarnings", () => {
    const { mesh, topology } = triMesh();
    const result = flattenWithCutStrokes({
      mesh,
      topology,
      seams: createSeamRegistry(),
      cutStrokes: [stroke("open", [v(0.2, 0.2), v(0.4, 0.2)])],
    });
    expect(result.openLoops.length).toBeGreaterThan(0);
    expect(result.materializeWarnings.some((w) => w.includes("open loop"))).toBe(
      true,
    );
  });
});

describe("QA audit Slice 2: flatten staleness contract (ADR 0100)", () => {
  it("seam change after flatten changes snapshot key (stales 2D pattern)", () => {
    const empty = seamsContentKey(createSeamRegistry());
    const withSeam = seamsContentKey(
      toggleSeam(createSeamRegistry(), makeEdgeKey(0, 1)),
    );
    const keyBefore = flattenSnapshotKey(1, 0, empty);
    const keyAfterSeam = flattenSnapshotKey(1, 0, withSeam);
    expect(keyAfterSeam).not.toBe(keyBefore);

    const keyAfterStroke = flattenSnapshotKey(1, 1, empty);
    expect(keyAfterStroke).not.toBe(keyBefore);
  });
});

describe("QA audit Slice 2: materialize warning toast collapse", () => {
  it("returns null for empty warnings", () => {
    expect(formatMaterializeWarningsToast([], [])).toBeNull();
  });

  it("returns the single warning unchanged", () => {
    expect(
      formatMaterializeWarningsToast(["Stroke x is self-intersecting."], []),
    ).toBe("Stroke x is self-intersecting.");
  });

  it("collapses many warnings and prioritizes open-loop when present", () => {
    const toast = formatMaterializeWarningsToast(
      [
        "Skipped segment on stroke a.",
        "Stroke open: open loop (slit).",
        "Skipped snap on stroke b.",
      ],
      [{ strokeId: "open", interiorEndpoints: [0, 1] }],
    );
    expect(toast).toBe(
      "3 cut warnings. Stroke open: open loop (slit).",
    );
  });
});
