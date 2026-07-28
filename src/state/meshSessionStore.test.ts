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
    seamMode: true,
    toasts: [],
    toastSeq: 0,
  });
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
  it("changes when patternRevision or meshLoadVersion changes", () => {
    expect(flattenSnapshotKey(1, 0)).toBe("1:0");
    expect(flattenSnapshotKey(1, 0)).not.toBe(flattenSnapshotKey(1, 1));
    expect(flattenSnapshotKey(1, 0)).not.toBe(flattenSnapshotKey(2, 0));
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

  it("rejects strokes with fewer than 2 points", () => {
    useMeshSessionStore.getState().addCutStroke({
      id: "short",
      points: [{ x: 0, y: 0, z: 0 }],
    });
    expect(useMeshSessionStore.getState().cutStrokes).toHaveLength(0);
    expect(useMeshSessionStore.getState().patternRevision).toBe(0);
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

  it("successful load clears cutStrokes and resets patternRevision", async () => {
    const previousRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    }) as typeof requestAnimationFrame;

    try {
      useMeshSessionStore.setState({
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
      });

      const file = new File([CUBE_OBJ], "cube.obj", { type: "text/plain" });
      const ok = await useMeshSessionStore.getState().loadMeshFile(file);
      expect(ok).toBe(true);

      const next = useMeshSessionStore.getState();
      expect(next.cutStrokes).toEqual([]);
      expect(next.patternRevision).toBe(0);
      expect(next.meshLoadVersion).toBe(2);
      expect(next.session).not.toBeNull();
    } finally {
      if (previousRaf) {
        globalThis.requestAnimationFrame = previousRaf;
      } else {
        Reflect.deleteProperty(globalThis, "requestAnimationFrame");
      }
    }
  });
});
