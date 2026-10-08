import { beforeEach, describe, expect, it } from "vitest";
import { buildTopology } from "../logic/mesh/buildTopology";
import { fenceEdgesFromStrokes } from "../logic/isolation/fenceEdgesFromStrokes";
import {
  branchedArmRingStroke,
  branchedTube,
  nonManifoldTripleEdge,
  openTube,
  tubeBandFaces,
  tubeCircumferentialLoop,
  tubeIncompleteRingStroke,
  tubeRingBraceletStroke,
  tubeVertex,
} from "../logic/isolation/testMeshes";
import type { CutStroke } from "../logic/cuts/types";
import type { MeshModel } from "../logic/mesh/types";
import {
  createSeamRegistry,
  toggleSeam,
} from "../logic/seams/seamRegistry";
import {
  flattenSnapshotKey,
  isolationContentKey,
  seamsContentKey,
  useMeshSessionStore,
  type MeshSession,
} from "./meshSessionStore";

const RINGS = 5;
const SIDES = 6;

const TRI_OBJ = `v 0 0 0
v 1 0 0
v 0 1 0
f 1 2 3
`;

function maskedFaces(mask: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) out.push(i);
  }
  return out;
}

function sessionFor(mesh: MeshModel, seams = createSeamRegistry()): MeshSession {
  return {
    mesh,
    topology: buildTopology(mesh),
    seams,
    fileName: "fixture.obj",
  };
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
    isolation: {
      active: false,
      mask: new Uint8Array(0),
      warnings: [],
      coversAllNonOrphanFaces: false,
    },
  });
}

function installSession(
  mesh: MeshModel,
  opts?: { seams?: MeshSession["seams"]; cutStrokes?: CutStroke[] },
) {
  const seams = opts?.seams ?? createSeamRegistry();
  useMeshSessionStore.setState({
    session: sessionFor(mesh, seams),
    meshLoadVersion: 7,
    patternRevision: 4,
    cutStrokes: opts?.cutStrokes ?? [],
    isolation: {
      active: false,
      mask: new Uint8Array(mesh.faceCount),
      warnings: [],
      coversAllNonOrphanFaces: false,
    },
  });
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

describe("flattenSnapshotKey isolation identity (ADR 0101)", () => {
  it("changes when mask bits or active change, and differs from a key that ignores isolation", () => {
    const idle = isolationContentKey(false, new Uint8Array([0, 0, 0, 0]));
    const masked = isolationContentKey(false, new Uint8Array([1, 0, 0, 0]));
    const live = isolationContentKey(true, new Uint8Array([1, 0, 0, 0]));
    const ignored = "1:0:";
    const withIdle = flattenSnapshotKey(1, 0, "", idle);
    const withMasked = flattenSnapshotKey(1, 0, "", masked);
    const withLive = flattenSnapshotKey(1, 0, "", live);

    expect(withIdle).not.toBe(withMasked);
    expect(withMasked).not.toBe(withLive);
    expect(withIdle).not.toBe(ignored);
    expect(withMasked).not.toBe(ignored);
    expect(withLive).not.toBe(ignored);
    expect(flattenSnapshotKey(1, 0, "", masked)).toBe(withMasked);
  });
});

describe("isolation overlay", () => {
  beforeEach(() => {
    resetStore();
  });

  it("no-ops seed when no mesh is loaded", () => {
    useMeshSessionStore.getState().applyIsolationFlood(0, "replace");
    const next = useMeshSessionStore.getState();
    expect(next.isolation.mask.length).toBe(0);
    expect(next.isolation.active).toBe(false);
    expect(next.meshLoadVersion).toBe(0);
    expect(next.patternRevision).toBe(0);
  });

  it("vertex-ring bracelets + seed select the arm band; confirm sets active without bumping versions", () => {
    const mesh = openTube(RINGS, SIDES);
    const strokes = [
      tubeRingBraceletStroke(mesh, "wrist", 1, SIDES),
      tubeRingBraceletStroke(mesh, "shoulder", 3, SIDES),
    ];
    installSession(mesh, { cutStrokes: strokes });
    const meshRef = useMeshSessionStore.getState().session!.mesh;

    useMeshSessionStore
      .getState()
      .applyIsolationFlood(tubeBandFaces(1, SIDES)[0]!, "replace");

    const expected = [
      ...tubeBandFaces(1, SIDES),
      ...tubeBandFaces(2, SIDES),
    ].sort((a, b) => a - b);
    const afterSeed = useMeshSessionStore.getState();
    expect(maskedFaces(afterSeed.isolation.mask)).toEqual(expected);
    expect(afterSeed.isolation.coversAllNonOrphanFaces).toBe(false);
    expect(afterSeed.isolation.active).toBe(false);
    expect(afterSeed.session!.mesh).toBe(meshRef);
    expect(afterSeed.session!.mesh.faceCount).toBe(mesh.faceCount);
    expect(afterSeed.session!.mesh.vertexCount).toBe(mesh.vertexCount);

    const seamsKey = seamsContentKey(afterSeed.session!.seams);
    const keyBefore = flattenSnapshotKey(
      7,
      4,
      seamsKey,
      isolationContentKey(false, new Uint8Array(mesh.faceCount)),
    );
    expect(useMeshSessionStore.getState().confirmIsolation()).toBe(true);

    const confirmed = useMeshSessionStore.getState();
    expect(confirmed.isolation.active).toBe(true);
    expect(maskedFaces(confirmed.isolation.mask)).toEqual(expected);
    expect(confirmed.meshLoadVersion).toBe(7);
    expect(confirmed.patternRevision).toBe(4);
    const keyAfter = flattenSnapshotKey(
      confirmed.meshLoadVersion,
      confirmed.patternRevision,
      seamsContentKey(confirmed.session!.seams),
      isolationContentKey(confirmed.isolation.active, confirmed.isolation.mask),
    );
    expect(keyAfter).not.toBe(keyBefore);

    useMeshSessionStore.getState().exitIsolation();
    const exited = useMeshSessionStore.getState();
    expect(exited.isolation.active).toBe(false);
    expect(maskedFaces(exited.isolation.mask)).toEqual(expected);
    expect(exited.meshLoadVersion).toBe(7);
    expect(exited.patternRevision).toBe(4);
    expect(exited.confirmIsolation()).toBe(true);
  });

  it("incomplete bracelet: flood covers every non-orphan and confirm stays inactive", () => {
    const mesh = openTube(RINGS, SIDES);
    installSession(mesh, {
      cutStrokes: [tubeIncompleteRingStroke(mesh, "gap", 2, SIDES, 0)],
    });

    useMeshSessionStore
      .getState()
      .applyIsolationFlood(tubeBandFaces(0, SIDES)[0]!, "replace");

    const next = useMeshSessionStore.getState();
    expect(next.isolation.coversAllNonOrphanFaces).toBe(true);
    expect(next.confirmIsolation()).toBe(false);
    expect(useMeshSessionStore.getState().isolation.active).toBe(false);
    expect(next.meshLoadVersion).toBe(7);
    expect(next.patternRevision).toBe(4);
  });

  it("mesh-minus-scar confirm is refused even though the mask is not every face", () => {
    const mesh = openTube(RINGS, SIDES);
    const vi = tubeVertex(2, 0, SIDES);
    const scar = {
      id: "scar",
      points: [
        {
          x: mesh.vertices[3 * vi]!,
          y: mesh.vertices[3 * vi + 1]!,
          z: mesh.vertices[3 * vi + 2]!,
        },
      ],
    };
    const fence = fenceEdgesFromStrokes(mesh, [scar]);
    expect(fence.fenceEdges.size).toBe(0);
    expect(fence.blockerFaces.size).toBeGreaterThan(0);
    expect(fence.blockerFaces.size).toBeLessThan(mesh.faceCount);

    let seed = -1;
    for (let i = 0; i < mesh.faceCount; i++) {
      if (!fence.blockerFaces.has(i)) {
        seed = i;
        break;
      }
    }
    expect(seed).toBeGreaterThanOrEqual(0);

    installSession(mesh, { cutStrokes: [scar] });
    useMeshSessionStore.getState().applyIsolationFlood(seed, "replace");

    const next = useMeshSessionStore.getState();
    expect(next.isolation.coversAllNonOrphanFaces).toBe(true);
    expect(maskedFaces(next.isolation.mask).length).toBeGreaterThan(0);
    expect(maskedFaces(next.isolation.mask).length).toBeLessThan(mesh.faceCount);
    for (const f of fence.blockerFaces) {
      expect(next.isolation.mask[f]).toBe(0);
    }
    expect(next.confirmIsolation()).toBe(false);
    expect(useMeshSessionStore.getState().isolation.active).toBe(false);
  });

  it("add and subtract change mask bits without bumping meshLoadVersion or patternRevision", () => {
    const mesh = openTube(RINGS, SIDES);
    const strokes = [
      tubeRingBraceletStroke(mesh, "wrist", 1, SIDES),
      tubeRingBraceletStroke(mesh, "shoulder", 3, SIDES),
    ];
    installSession(mesh, { cutStrokes: strokes });

    const store = useMeshSessionStore.getState();
    store.applyIsolationFlood(tubeBandFaces(0, SIDES)[0]!, "replace");
    expect(maskedFaces(useMeshSessionStore.getState().isolation.mask)).toEqual(
      [...tubeBandFaces(0, SIDES)].sort((a, b) => a - b),
    );

    useMeshSessionStore
      .getState()
      .applyIsolationFlood(tubeBandFaces(1, SIDES)[0]!, "add");
    expect(maskedFaces(useMeshSessionStore.getState().isolation.mask)).toEqual(
      [
        ...tubeBandFaces(0, SIDES),
        ...tubeBandFaces(1, SIDES),
        ...tubeBandFaces(2, SIDES),
      ].sort((a, b) => a - b),
    );

    useMeshSessionStore
      .getState()
      .applyIsolationFlood(tubeBandFaces(0, SIDES)[0]!, "subtract");
    const next = useMeshSessionStore.getState();
    expect(maskedFaces(next.isolation.mask)).toEqual(
      [...tubeBandFaces(1, SIDES), ...tubeBandFaces(2, SIDES)].sort(
        (a, b) => a - b,
      ),
    );
    expect(next.meshLoadVersion).toBe(7);
    expect(next.patternRevision).toBe(4);
    expect(next.isolation.active).toBe(false);
  });

  it("bracelet on limb A leaves limb B unmasked", () => {
    const branched = branchedTube(4, 3);
    installSession(branched.mesh, {
      cutStrokes: [branchedArmRingStroke(branched, "wrist", 1)],
    });

    useMeshSessionStore
      .getState()
      .applyIsolationFlood(branched.armBandFaces(1)[0]!, "replace");

    const { mask } = useMeshSessionStore.getState().isolation;
    for (const f of branched.armBandFaces(1)) {
      expect(mask[f]).toBe(1);
    }
    for (const f of branched.armBandFaces(0)) {
      expect(mask[f]).toBe(0);
    }
    for (let band = 0; band < branched.torsoBands; band++) {
      for (const f of branched.torsoBandFaces(band)) {
        expect(mask[f]).toBe(0);
      }
    }
    expect(useMeshSessionStore.getState().confirmIsolation()).toBe(true);
  });

  it("manual seam cycle stops the seed the same way a bracelet does", () => {
    const mesh = openTube(RINGS, SIDES);
    let seams = createSeamRegistry();
    for (const key of tubeCircumferentialLoop(2, SIDES)) {
      seams = toggleSeam(seams, key);
    }
    installSession(mesh, { seams });

    useMeshSessionStore
      .getState()
      .applyIsolationFlood(tubeBandFaces(0, SIDES)[0]!, "replace");

    const flooded = new Set(
      maskedFaces(useMeshSessionStore.getState().isolation.mask),
    );
    for (const f of tubeBandFaces(0, SIDES)) expect(flooded.has(f)).toBe(true);
    for (const f of tubeBandFaces(1, SIDES)) expect(flooded.has(f)).toBe(true);
    for (const f of tubeBandFaces(2, SIDES)) expect(flooded.has(f)).toBe(false);
    for (const f of tubeBandFaces(3, SIDES)) expect(flooded.has(f)).toBe(false);
    expect(
      useMeshSessionStore.getState().isolation.coversAllNonOrphanFaces,
    ).toBe(false);
  });

  it("keeps non-manifold flood warnings on the overlay", () => {
    const mesh = nonManifoldTripleEdge();
    installSession(mesh);
    useMeshSessionStore.getState().applyIsolationFlood(0, "replace");
    const next = useMeshSessionStore.getState();
    expect(next.isolation.warnings.some((w) => /non-manifold/i.test(w))).toBe(
      true,
    );
    expect(next.session!.mesh.faceCount).toBe(mesh.faceCount);
    expect(maskedFaces(next.isolation.mask)).toEqual([0]);
  });

  it("switching edit tool does not clear the mask or bump versions", () => {
    const mesh = openTube(RINGS, SIDES);
    installSession(mesh, {
      cutStrokes: [
        tubeRingBraceletStroke(mesh, "wrist", 1, SIDES),
        tubeRingBraceletStroke(mesh, "shoulder", 3, SIDES),
      ],
    });
    useMeshSessionStore
      .getState()
      .applyIsolationFlood(tubeBandFaces(1, SIDES)[0]!, "replace");
    expect(useMeshSessionStore.getState().confirmIsolation()).toBe(true);

    useMeshSessionStore.getState().setMeshEditTool("isolate");
    useMeshSessionStore.getState().setMeshEditTool("seam");
    const next = useMeshSessionStore.getState();
    expect(next.meshEditTool).toBe("seam");
    expect(next.isolation.active).toBe(true);
    expect(maskedFaces(next.isolation.mask)).toEqual(
      [...tubeBandFaces(1, SIDES), ...tubeBandFaces(2, SIDES)].sort(
        (a, b) => a - b,
      ),
    );
    expect(next.meshLoadVersion).toBe(7);
    expect(next.patternRevision).toBe(4);
  });

  it("successful load clears the mask; failed load preserves it", async () => {
    await withImmediateRaf(async () => {
      const mesh = openTube(RINGS, SIDES);
      installSession(mesh, {
        cutStrokes: [
          tubeRingBraceletStroke(mesh, "wrist", 1, SIDES),
          tubeRingBraceletStroke(mesh, "shoulder", 3, SIDES),
        ],
      });
      useMeshSessionStore
        .getState()
        .applyIsolationFlood(tubeBandFaces(1, SIDES)[0]!, "replace");
      expect(useMeshSessionStore.getState().confirmIsolation()).toBe(true);
      const keptMask = new Uint8Array(
        useMeshSessionStore.getState().isolation.mask,
      );
      expect(keptMask.some((b) => b === 1)).toBe(true);

      const bad = new File(["not a mesh"], "bad.txt", { type: "text/plain" });
      const failed = await useMeshSessionStore.getState().loadMeshFile(bad);
      expect(failed).toBe(false);
      const preserved = useMeshSessionStore.getState();
      expect(preserved.isolation.active).toBe(true);
      expect(preserved.isolation.mask).toEqual(keptMask);
      expect(preserved.meshLoadVersion).toBe(7);
      expect(preserved.patternRevision).toBe(4);
      expect(preserved.cutStrokes).toHaveLength(2);

      const file = new File([TRI_OBJ], "tri.obj", { type: "text/plain" });
      const ok = await useMeshSessionStore.getState().loadMeshFile(file);
      expect(ok).toBe(true);
      const cleared = useMeshSessionStore.getState();
      expect(cleared.isolation.active).toBe(false);
      expect(cleared.isolation.coversAllNonOrphanFaces).toBe(false);
      expect(cleared.isolation.warnings).toEqual([]);
      expect(cleared.isolation.mask.length).toBe(cleared.session!.mesh.faceCount);
      expect(maskedFaces(cleared.isolation.mask)).toEqual([]);
      expect(cleared.cutStrokes).toEqual([]);
      expect(cleared.meshLoadVersion).toBe(8);
      expect(cleared.patternRevision).toBe(0);
    });
  });
});
