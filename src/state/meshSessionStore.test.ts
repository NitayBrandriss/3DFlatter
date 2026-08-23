import { beforeEach, describe, expect, it } from "vitest";
import { parseObj } from "../logic/io/obj/parseObj";
import { buildTopology } from "../logic/mesh/buildTopology";
import { makeEdgeKey } from "../logic/mesh/edgeKey";
import {
  createSeamRegistry,
  toggleSeam,
} from "../logic/seams/seamRegistry";
import {
  computeSessionStats,
  flattenSnapshotKey,
  formatLoadErrorToast,
  LOAD_ERROR_TOAST_DURATION_MS,
  seamsContentKey,
  useMeshSessionStore,
  type MeshSession,
} from "./meshSessionStore";

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

function withSession() {
  useMeshSessionStore.setState({ session: cubeSession(), meshLoadVersion: 1 });
}

async function withImmediateRaf<T>(fn: () => Promise<T>): Promise<T> {
  const previousRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  }) as typeof requestAnimationFrame;
  try {
    return await fn();
  } finally {
    if (previousRaf) {
      globalThis.requestAnimationFrame = previousRaf;
    } else {
      Reflect.deleteProperty(globalThis, "requestAnimationFrame");
    }
  }
}

describe("seamsContentKey", () => {
  it("is empty for an empty registry", () => {
    expect(seamsContentKey(createSeamRegistry())).toBe("");
  });

  it("is order-independent and stable across registry identity", () => {
    const a = makeEdgeKey(0, 1);
    const b = makeEdgeKey(2, 3);
    const forward = toggleSeam(toggleSeam(createSeamRegistry(), a), b);
    const reverse = toggleSeam(toggleSeam(createSeamRegistry(), b), a);
    const clone = { seams: new Set(forward.seams) };

    expect(seamsContentKey(forward)).toBe(seamsContentKey(reverse));
    expect(seamsContentKey(forward)).toBe(seamsContentKey(clone));
    expect(seamsContentKey(forward)).not.toBe("");
  });

  it("changes when seam membership changes", () => {
    const a = makeEdgeKey(0, 1);
    const empty = createSeamRegistry();
    const withA = toggleSeam(empty, a);
    expect(seamsContentKey(withA)).not.toBe(seamsContentKey(empty));
  });
});

describe("flattenSnapshotKey", () => {
  it("changes when patternRevision, meshLoadVersion, or seamsKey changes", () => {
    expect(flattenSnapshotKey(1, 0, "")).toBe("1:0:");
    expect(flattenSnapshotKey(1, 0, "")).not.toBe(flattenSnapshotKey(1, 1, ""));
    expect(flattenSnapshotKey(1, 0, "")).not.toBe(flattenSnapshotKey(2, 0, ""));
    expect(flattenSnapshotKey(1, 0, "")).not.toBe(
      flattenSnapshotKey(1, 0, makeEdgeKey(0, 1)),
    );
    expect(flattenSnapshotKey(1, 0, "a")).toBe(flattenSnapshotKey(1, 0, "a"));
  });

  it("ADR 0100: seam or stroke revision change stales flatten snapshot", () => {
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
    const keyBefore = flattenSnapshotKey(1, 0, seamsA);
    expect(flattenSnapshotKey(1, 1, seamsA)).not.toBe(keyBefore);
  });
});

describe("computeSessionStats", () => {
  it("reports a single island for a closed cube with no seams", () => {
    const stats = computeSessionStats(cubeSession());
    expect(stats).not.toBeNull();
    expect(stats!.faceCount).toBe(12);
    expect(stats!.seamCount).toBe(0);
    expect(stats!.islandCount).toBe(1);
  });

  it("updates seam count after a seam toggle", () => {
    const key = makeEdgeKey(0, 1);
    const stats = computeSessionStats(cubeSession(toggleSeam(createSeamRegistry(), key)));
    expect(stats!.seamCount).toBe(1);
    expect(stats!.islandCount).toBe(1);
  });
});

describe("cutStrokes CRUD", () => {
  beforeEach(() => {
    resetStore();
    withSession();
  });

  it("addCutStroke appends and bumps patternRevision without meshLoadVersion", () => {
    const store = useMeshSessionStore.getState();
    const loadBefore = store.meshLoadVersion;
    const revBefore = store.patternRevision;

    store.addCutStroke({
      id: "a",
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
    });

    const next = useMeshSessionStore.getState();
    expect(next.cutStrokes).toHaveLength(1);
    expect(next.cutStrokes[0]!.id).toBe("a");
    expect(next.patternRevision).toBe(revBefore + 1);
    expect(next.meshLoadVersion).toBe(loadBefore);
  });

  it("addCutStroke does not mutate session.mesh buffers", () => {
    const session = cubeSession();
    const vertsBefore = Array.from(session.mesh.vertices);
    useMeshSessionStore.setState({ session, meshLoadVersion: 1 });
    useMeshSessionStore.getState().addCutStroke({
      id: "c",
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
    });
    expect(Array.from(session.mesh.vertices)).toEqual(vertsBefore);
    expect(useMeshSessionStore.getState().session!.mesh).toBe(session.mesh);
  });

  it("deep-copies points so external mutation cannot corrupt the store", () => {
    const p0 = { x: 0, y: 0, z: 0 };
    const p1 = { x: 1, y: 0, z: 0 };
    const points = [p0, p1];
    useMeshSessionStore.getState().addCutStroke({ id: "mut", points });
    p0.x = 99;
    points.push({ x: 2, y: 2, z: 2 });
    const stored = useMeshSessionStore.getState().cutStrokes[0]!;
    expect(stored.points).toHaveLength(2);
    expect(stored.points[0]!.x).toBe(0);
  });

  it("rejects strokes with fewer than 2 points", () => {
    useMeshSessionStore.getState().addCutStroke({
      id: "short",
      points: [{ x: 0, y: 0, z: 0 }],
    });
    expect(useMeshSessionStore.getState().cutStrokes).toHaveLength(0);
    expect(useMeshSessionStore.getState().patternRevision).toBe(0);
  });

  it("replace-on-add upserts by id instead of allowing duplicates", () => {
    const store = useMeshSessionStore.getState();
    store.addCutStroke({
      id: "dup",
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
    });
    store.addCutStroke({
      id: "dup",
      points: [
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 1, z: 0 },
      ],
    });
    const strokes = useMeshSessionStore.getState().cutStrokes;
    expect(strokes).toHaveLength(1);
    expect(strokes[0]!.points[0]!.y).toBe(1);
    expect(useMeshSessionStore.getState().patternRevision).toBe(2);
  });

  it("updateCutStroke replaces points and bumps patternRevision", () => {
    const store = useMeshSessionStore.getState();
    store.addCutStroke({
      id: "a",
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
    });
    const loadBefore = useMeshSessionStore.getState().meshLoadVersion;
    const revBefore = useMeshSessionStore.getState().patternRevision;

    store.updateCutStroke("a", [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 1, y: 1, z: 0 },
    ]);

    const next = useMeshSessionStore.getState();
    expect(next.cutStrokes[0]!.points).toHaveLength(3);
    expect(next.patternRevision).toBe(revBefore + 1);
    expect(next.meshLoadVersion).toBe(loadBefore);
  });

  it("updateCutStroke deep-copies points against later mutation", () => {
    useMeshSessionStore.getState().addCutStroke({
      id: "u",
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
    });
    const p0 = { x: 0, y: 1, z: 0 };
    const p1 = { x: 1, y: 1, z: 0 };
    const nextPts = [p0, p1];
    useMeshSessionStore.getState().updateCutStroke("u", nextPts);
    p0.y = -1;
    expect(useMeshSessionStore.getState().cutStrokes[0]!.points[0]!.y).toBe(1);
  });

  it("updateCutStroke with fewer than 2 points is a no-op", () => {
    useMeshSessionStore.getState().addCutStroke({
      id: "a",
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
    });
    const rev = useMeshSessionStore.getState().patternRevision;
    useMeshSessionStore.getState().updateCutStroke("a", [{ x: 0, y: 0, z: 0 }]);
    expect(useMeshSessionStore.getState().patternRevision).toBe(rev);
    expect(useMeshSessionStore.getState().cutStrokes[0]!.points).toHaveLength(2);
  });

  it("deleteCutStroke and clearCutStrokes bump patternRevision", () => {
    const store = useMeshSessionStore.getState();
    store.addCutStroke({
      id: "a",
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
    });
    store.addCutStroke({
      id: "b",
      points: [
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 1, z: 0 },
      ],
    });
    const loadBefore = useMeshSessionStore.getState().meshLoadVersion;

    store.deleteCutStroke("a");
    expect(useMeshSessionStore.getState().cutStrokes.map((c) => c.id)).toEqual([
      "b",
    ]);

    store.clearCutStrokes();
    const next = useMeshSessionStore.getState();
    expect(next.cutStrokes).toEqual([]);
    // 2 adds + delete + clear
    expect(next.patternRevision).toBe(4);
    expect(next.meshLoadVersion).toBe(loadBefore);
  });

  it("does not bump patternRevision when deleting a missing id or clearing empty", () => {
    useMeshSessionStore.getState().deleteCutStroke("missing");
    useMeshSessionStore.getState().clearCutStrokes();
    expect(useMeshSessionStore.getState().patternRevision).toBe(0);
  });

  it("stroke CRUD no-ops when session is null", () => {
    useMeshSessionStore.setState({ session: null, patternRevision: 0, cutStrokes: [] });
    useMeshSessionStore.getState().addCutStroke({
      id: "orphan",
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
    });
    expect(useMeshSessionStore.getState().cutStrokes).toHaveLength(0);
    expect(useMeshSessionStore.getState().patternRevision).toBe(0);
  });

  it("toggleSeamAt does not bump patternRevision or meshLoadVersion", () => {
    const session = cubeSession();
    useMeshSessionStore.setState({
      session,
      meshLoadVersion: 2,
      patternRevision: 5,
      cutStrokes: [],
    });
    const edge = [...session.topology.edgeToFaces.keys()][0]!;
    useMeshSessionStore.getState().toggleSeamAt(edge);

    const next = useMeshSessionStore.getState();
    expect(next.meshLoadVersion).toBe(2);
    expect(next.patternRevision).toBe(5);
    expect(next.session!.seams.seams.has(edge)).toBe(true);
  });

  it("clearAllSeams does not bump patternRevision or meshLoadVersion", () => {
    const session = cubeSession(
      toggleSeam(createSeamRegistry(), makeEdgeKey(0, 1)),
    );
    useMeshSessionStore.setState({
      session,
      meshLoadVersion: 3,
      patternRevision: 7,
      cutStrokes: [
        {
          id: "x",
          points: [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
          ],
        },
      ],
    });
    useMeshSessionStore.getState().clearAllSeams();
    const next = useMeshSessionStore.getState();
    expect(next.patternRevision).toBe(7);
    expect(next.meshLoadVersion).toBe(3);
    expect(next.session!.seams.seams.size).toBe(0);
    expect(next.cutStrokes).toHaveLength(1);
  });

  it("failed load preserves cutStrokes and patternRevision", async () => {
    await withImmediateRaf(async () => {
      useMeshSessionStore.setState({
        cutStrokes: [
          {
            id: "keep",
            points: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
            ],
          },
        ],
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
      expect(next.toasts).toHaveLength(1);
      expect(next.toasts[0]!.tone).toBe("warning");
      expect(next.toasts[0]!.text).toMatch(/^Could not load mesh:/);
      expect(next.toasts[0]!.duration).toBe(LOAD_ERROR_TOAST_DURATION_MS);
    });
  });

  it("corrupt OBJ toasts a warning and keeps the same session reference", async () => {
    await withImmediateRaf(async () => {
      const session = cubeSession();
      useMeshSessionStore.setState({
        session,
        meshLoadVersion: 1,
        patternRevision: 2,
        error: null,
        toasts: [],
        toastSeq: 0,
      });

      const corruptObj = `
v 0 0 0
v 1 0 0
v 0 1 0
f 1 2 99
`;
      const file = new File([corruptObj], "bad.obj", { type: "text/plain" });
      const ok = await useMeshSessionStore.getState().loadMeshFile(file);
      expect(ok).toBe(false);

      const next = useMeshSessionStore.getState();
      expect(next.session).toBe(session);
      expect(next.meshLoadVersion).toBe(1);
      expect(next.patternRevision).toBe(2);
      expect(next.error).toMatch(/out-of-range vertex/i);
      expect(next.toasts).toHaveLength(1);
      expect(next.toasts[0]!.tone).toBe("warning");
      expect(next.toasts[0]!.text).toBe(formatLoadErrorToast(next.error!));
      expect(next.toasts[0]!.text.length).toBeLessThanOrEqual(120);
      expect(next.toasts[0]!.duration).toBe(LOAD_ERROR_TOAST_DURATION_MS);
    });
  });

  it("successful load clears cutStrokes, prior error, and resets patternRevision", async () => {
    await withImmediateRaf(async () => {
      useMeshSessionStore.setState({
        session: cubeSession(),
        cutStrokes: [
          {
            id: "old",
            points: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
            ],
          },
        ],
        patternRevision: 4,
        meshLoadVersion: 1,
        error: "previous failure",
      });

      const file = new File([CUBE_OBJ], "cube.obj", { type: "text/plain" });
      const ok = await useMeshSessionStore.getState().loadMeshFile(file);
      expect(ok).toBe(true);

      const next = useMeshSessionStore.getState();
      expect(next.cutStrokes).toEqual([]);
      expect(next.patternRevision).toBe(0);
      expect(next.meshLoadVersion).toBe(2);
      expect(next.session).not.toBeNull();
      expect(next.error).toBeNull();
    });
  });
});

describe("formatLoadErrorToast", () => {
  it("prefixes and truncates long parser messages", () => {
    const short = formatLoadErrorToast("unsupported type");
    expect(short).toBe("Could not load mesh: unsupported type");

    const long = "x".repeat(200);
    const toast = formatLoadErrorToast(long);
    expect(toast.startsWith("Could not load mesh: ")).toBe(true);
    expect(toast.endsWith("…")).toBe(true);
    expect(toast.length).toBe(120);
  });
});

describe("notifyToast duration", () => {
  it("omits duration so the UI uses the default 4s dismiss", () => {
    resetStore();
    useMeshSessionStore.getState().notifyToast("hello", "info");
    const toast = useMeshSessionStore.getState().toasts[0]!;
    expect(toast.duration).toBeUndefined();
  });
});
