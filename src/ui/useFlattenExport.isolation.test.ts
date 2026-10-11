import { beforeEach, describe, expect, it, vi } from "vitest";
import * as flattenModule from "@/logic/cuts/flattenWithCutStrokes";
import { createFaceMask, maskFromFaces } from "@/logic/isolation/faceMask";
import { openTube, tubeBandFaces } from "@/logic/isolation/testMeshes";
import type { FaceMask } from "@/logic/isolation/types";
import { buildTopology } from "@/logic/mesh/buildTopology";
import type { MeshModel, UnfoldMeshResult } from "@/logic/mesh/types";
import { createSeamRegistry } from "@/logic/seams/seamRegistry";
import type { MeshSession } from "@/state/meshSessionStore";
import { useFlattenExport } from "./useFlattenExport";

const reactState = vi.hoisted(() => ({
  cells: [] as { value: unknown }[],
  cursor: 0,
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: <T,>(init: T | (() => T)) => {
      const index = reactState.cursor;
      reactState.cursor += 1;
      if (reactState.cells[index] === undefined) {
        const value = typeof init === "function" ? (init as () => T)() : init;
        reactState.cells[index] = { value };
      }
      const setState = (next: T | ((prev: T) => T)) => {
        const cell = reactState.cells[index]!;
        cell.value =
          typeof next === "function"
            ? (next as (prev: T) => T)(cell.value as T)
            : next;
      };
      return [reactState.cells[index]!.value as T, setState] as const;
    },
    useCallback: <T,>(fn: T) => fn,
  };
});

const OPEN_LOOP_WARNING =
  'Cut stroke "in" is an open loop (endpoint not on a free boundary); may not split a closed shell';

function unfoldedFaceCount(result: UnfoldMeshResult | null): number {
  if (!result) return 0;
  return result.islands.reduce((count, island) => count + island.faces.length, 0);
}

function sessionFor(mesh: MeshModel): MeshSession {
  return {
    mesh,
    topology: buildTopology(mesh),
    seams: createSeamRegistry(),
    fileName: "tube.obj",
  };
}

describe("useFlattenExport isolation", () => {
  const toasts: { text: string; tone?: "info" | "warning" }[] = [];

  beforeEach(() => {
    reactState.cells.length = 0;
    reactState.cursor = 0;
    toasts.length = 0;
    vi.restoreAllMocks();
  });

  function useRenderedExport(
    session: MeshSession,
    isolation: { active: boolean; mask: FaceMask },
  ) {
    reactState.cursor = 0;
    return useFlattenExport(session, 1, 0, isolation, [], (text, tone) => {
      toasts.push({ text, tone });
    });
  }

  it("toasts the skip sentence before a materialize warning", () => {
    const mesh = openTube(5, 4);
    const session = sessionFor(mesh);
    const mask = maskFromFaces(mesh.faceCount, [
      ...tubeBandFaces(1, 4),
      ...tubeBandFaces(2, 4),
    ]);
    vi.spyOn(flattenModule, "flattenWithCutStrokes").mockReturnValue({
      unfold: {
        islands: [],
        bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
        seamSegments: [],
        collisions: [],
        tears: [],
      },
      materializeWarnings: [OPEN_LOOP_WARNING],
      openLoops: [],
      appliedSeams: session.seams.seams,
      materializedStrokeIds: ["in"],
      skippedStrokes: [{ id: "ghost", relation: "outside" }],
      flattenMesh: mesh,
    });

    const view = useRenderedExport(session, { active: true, mask });
    expect(view.onFlatten()).toBe(true);
    expect(toasts.map((toast) => toast.text)).toEqual([
      "Skipped 1 cut stroke not wholly inside the isolate.",
      OPEN_LOOP_WARNING,
    ]);
    expect(toasts.every((toast) => toast.tone === "warning")).toBe(true);
  });

  it("clears the previous snapshot when an empty isolate throws", () => {
    const mesh = openTube(5, 4);
    const session = sessionFor(mesh);
    const mask = createFaceMask(mesh.faceCount);

    const first = useRenderedExport(session, { active: false, mask });
    expect(first.onFlatten()).toBe(true);
    const afterSuccess = useRenderedExport(session, { active: false, mask });
    expect(unfoldedFaceCount(afterSuccess.flattenResult)).toBe(32);

    const active = useRenderedExport(session, { active: true, mask });
    expect(active.onFlatten()).toBe(false);
    expect(toasts.some((toast) => /empty isolate subset/.test(toast.text))).toBe(
      true,
    );
    expect(
      toasts.find((toast) => /empty isolate subset/.test(toast.text))?.tone,
    ).toBe("warning");

    const afterThrow = useRenderedExport(session, { active: false, mask });
    expect(afterThrow.flattenResult).toBeNull();
  });

  it("forwards the active mask into flattenWithCutStrokes", () => {
    const mesh = openTube(5, 4);
    const session = sessionFor(mesh);
    const mask = maskFromFaces(mesh.faceCount, [
      ...tubeBandFaces(1, 4),
      ...tubeBandFaces(2, 4),
    ]);
    const spy = vi.spyOn(flattenModule, "flattenWithCutStrokes");

    const view = useRenderedExport(session, { active: true, mask });
    expect(view.onFlatten()).toBe(true);
    const after = useRenderedExport(session, { active: true, mask });

    expect(spy).toHaveBeenCalledTimes(1);
    const call = spy.mock.calls[0]?.[0];
    expect(call?.isolation).toEqual({ active: true, mask });
    expect(call?.mesh).toBe(session.mesh);
    expect(call?.topology).toBe(session.topology);
    expect(call?.cutStrokes).toEqual([]);
    expect(unfoldedFaceCount(after.flattenResult)).toBe(16);
    expect(mesh.faceCount).toBe(32);
  });
});
