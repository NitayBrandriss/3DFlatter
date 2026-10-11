import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as flattenModule from "@/logic/cuts/flattenWithCutStrokes";
import type { CutStroke, Vec3 } from "@/logic/cuts/types";
import { createFaceMask, maskFromFaces } from "@/logic/isolation/faceMask";
import { floodFromFace } from "@/logic/isolation/floodFromFace";
import {
  nonManifoldTripleEdge,
  openTube,
  tubeBandFaces,
  tubeBraceletStroke,
  tubeVertex,
} from "@/logic/isolation/testMeshes";
import type { FaceMask } from "@/logic/isolation/types";
import { buildTopology } from "@/logic/mesh/buildTopology";
import type { MeshModel, UnfoldMeshResult } from "@/logic/mesh/types";
import { createSeamRegistry } from "@/logic/seams/seamRegistry";
import type { MeshSession } from "@/state/meshSessionStore";
import { useFlattenExport } from "./useFlattenExport";

type NotifyToast = (text: string, tone?: "info" | "warning") => void;

type FlattenProps = {
  session: MeshSession | null;
  meshLoadVersion: number;
  patternRevision: number;
  isolation: { active: boolean; mask: FaceMask; warnings: string[] };
  cutStrokes: readonly CutStroke[];
  notifyToast: NotifyToast;
};

const slots = vi.hoisted(() => {
  const cells: unknown[] = [];
  let cursor = 0;
  let rendering = false;
  let rerender: (() => void) | null = null;

  function useState<T>(
    init: T | (() => T),
  ): [T, (next: T | ((prev: T) => T)) => void] {
    const index = cursor++;
    if (index === cells.length) {
      cells.push(typeof init === "function" ? (init as () => T)() : init);
    }
    const setState = (next: T | ((prev: T) => T)) => {
      const prev = cells[index] as T;
      cells[index] =
        typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
      if (!rendering && rerender) rerender();
    };
    return [cells[index] as T, setState];
  }

  function useCallback<T>(fn: T): T {
    return fn;
  }

  return {
    reset() {
      cells.length = 0;
      cursor = 0;
      rendering = false;
    },
    begin() {
      cursor = 0;
      rendering = true;
    },
    end() {
      rendering = false;
    },
    setRerender(fn: () => void) {
      rerender = fn;
    },
    useState,
    useCallback,
  };
});

function tubeSession(mesh = openTube(2, 4)): MeshSession {
  return {
    mesh,
    topology: buildTopology(mesh),
    seams: createSeamRegistry(),
    fileName: "tube.obj",
  };
}

function unfoldedFaceCount(result: UnfoldMeshResult | null): number {
  if (!result) return 0;
  return result.islands.reduce((count, island) => count + island.faces.length, 0);
}

function longitudinalMidpoint(
  mesh: MeshModel,
  band: number,
  side: number,
  sides: number,
): Vec3 {
  const a = tubeVertex(band, side, sides);
  const b = tubeVertex(band + 1, side, sides);
  return {
    x: (mesh.vertices[3 * a]! + mesh.vertices[3 * b]!) / 2,
    y: (mesh.vertices[3 * a + 1]! + mesh.vertices[3 * b + 1]!) / 2,
    z: (mesh.vertices[3 * a + 2]! + mesh.vertices[3 * b + 2]!) / 2,
  };
}

const SKIP_SENTENCE = "Skipped 1 cut stroke not wholly inside the isolate.";

/**
 * React's ESM namespace is not configurable, so useState cannot be spied.
 * The real exports still dispatch through this client internals object.
 */
const reactHooks = (
  React as unknown as {
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: {
      H: null | Record<string, unknown>;
    };
  }
).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

describe("useFlattenExport", () => {
  let current: ReturnType<typeof useFlattenExport>;
  let props: FlattenProps;
  let previousDispatcher: null | Record<string, unknown> = null;

  function useRenderedExport() {
    slots.begin();
    try {
      current = useFlattenExport(
        props.session,
        props.meshLoadVersion,
        props.patternRevision,
        props.isolation,
        props.cutStrokes,
        props.notifyToast,
      );
    } finally {
      slots.end();
    }
  }

  beforeEach(() => {
    slots.reset();
    vi.restoreAllMocks();
    previousDispatcher = reactHooks.H;
    reactHooks.H = {
      useState: slots.useState,
      useCallback: slots.useCallback,
    };
    slots.setRerender(useRenderedExport);
  });

  afterEach(() => {
    reactHooks.H = previousDispatcher;
  });

  it("ISO-UI-002 toasts a crossing stroke skipped by an active isolate", () => {
    const mesh = openTube(5, 4);
    expect(mesh.faceCount).toBe(32);
    const session = tubeSession(mesh);
    const mask = maskFromFaces(mesh.faceCount, [
      ...tubeBandFaces(1, 4),
      ...tubeBandFaces(2, 4),
    ]);
    const strokes = [
      tubeBraceletStroke(mesh, "in", 1, 4),
      {
        id: "cross",
        points: [
          longitudinalMidpoint(mesh, 1, 0, 4),
          longitudinalMidpoint(mesh, 3, 0, 4),
        ],
      },
    ];
    const notifyToast = vi.fn();
    const spy = vi.spyOn(flattenModule, "flattenWithCutStrokes");

    props = {
      session,
      meshLoadVersion: 1,
      patternRevision: 0,
      isolation: { active: true, mask, warnings: [] },
      cutStrokes: strokes,
      notifyToast,
    };
    useRenderedExport();

    expect(current.onFlatten()).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0].isolation).toEqual({ active: true, mask });
    const flattened = spy.mock.results[0]?.value as ReturnType<
      typeof flattenModule.flattenWithCutStrokes
    >;
    expect(flattened.materializedStrokeIds).toEqual(["in"]);
    expect(flattened.skippedStrokes).toEqual([
      { id: "cross", relation: "crossing" },
    ]);
    expect(notifyToast).toHaveBeenCalledWith(SKIP_SENTENCE, "warning");
    expect(unfoldedFaceCount(current.flattenResult)).toBeGreaterThan(16);
  });

  it("ISO-UI-002 does not skip-toast the same strokes when isolation is inactive", () => {
    const mesh = openTube(5, 4);
    const session = tubeSession(mesh);
    const mask = maskFromFaces(mesh.faceCount, [
      ...tubeBandFaces(1, 4),
      ...tubeBandFaces(2, 4),
    ]);
    const strokes = [
      tubeBraceletStroke(mesh, "in", 1, 4),
      {
        id: "cross",
        points: [
          longitudinalMidpoint(mesh, 1, 0, 4),
          longitudinalMidpoint(mesh, 3, 0, 4),
        ],
      },
    ];
    const notifyToast = vi.fn();
    const spy = vi.spyOn(flattenModule, "flattenWithCutStrokes");

    props = {
      session,
      meshLoadVersion: 1,
      patternRevision: 0,
      isolation: { active: false, mask, warnings: [] },
      cutStrokes: strokes,
      notifyToast,
    };
    useRenderedExport();

    expect(current.onFlatten()).toBe(true);
    const flattened = spy.mock.results[0]?.value as ReturnType<
      typeof flattenModule.flattenWithCutStrokes
    >;
    expect(flattened.skippedStrokes).toEqual([]);
    expect(
      notifyToast.mock.calls.some((call) =>
        String(call[0]).includes("not wholly inside the isolate"),
      ),
    ).toBe(false);
  });

  it("clears the snapshot when a confirmed empty isolate throws", () => {
    const session = tubeSession();
    const notifyToast = vi.fn();
    const mask = createFaceMask(session.mesh.faceCount);

    props = {
      session,
      meshLoadVersion: 1,
      patternRevision: 0,
      isolation: { active: false, mask, warnings: [] },
      cutStrokes: [],
      notifyToast,
    };
    useRenderedExport();
    expect(current.onFlatten()).toBe(true);
    expect(current.flattenResult).not.toBeNull();

    props = {
      ...props,
      isolation: { active: true, mask, warnings: [] },
    };
    useRenderedExport();

    expect(current.onFlatten()).toBe(false);
    expect(notifyToast).toHaveBeenCalledWith(
      expect.stringMatching(/empty isolate subset/),
      "warning",
    );
    expect(current.flattenResult).toBeNull();

    props = {
      ...props,
      isolation: { active: false, mask, warnings: [] },
    };
    useRenderedExport();
    expect(current.flattenResult).toBeNull();
  });

  it("ISO-UI-003 unfolds the masked face when isolation is active", () => {
    const session = tubeSession();
    expect(session.mesh.faceCount).toBe(8);
    const mask = maskFromFaces(8, [0]);
    const notifyToast = vi.fn();

    props = {
      session,
      meshLoadVersion: 1,
      patternRevision: 0,
      isolation: { active: true, mask, warnings: [] },
      cutStrokes: [],
      notifyToast,
    };
    useRenderedExport();

    expect(current.onFlatten()).toBe(true);
    expect(unfoldedFaceCount(current.flattenResult)).toBe(1);
  });

  it("ISO-UI-003 unfolds the whole mesh when the same mask is inactive", () => {
    const session = tubeSession();
    const mask = maskFromFaces(8, [0]);
    const notifyToast = vi.fn();

    props = {
      session,
      meshLoadVersion: 1,
      patternRevision: 0,
      isolation: { active: false, mask, warnings: [] },
      cutStrokes: [],
      notifyToast,
    };
    useRenderedExport();

    expect(current.onFlatten()).toBe(true);
    expect(unfoldedFaceCount(current.flattenResult)).toBe(8);
  });

  it("ISO-UI-003 toasts a mask length failure and leaves no snapshot", () => {
    const session = tubeSession();
    const notifyToast = vi.fn();

    props = {
      session,
      meshLoadVersion: 1,
      patternRevision: 0,
      isolation: { active: true, mask: new Uint8Array(1), warnings: [] },
      cutStrokes: [],
      notifyToast,
    };
    useRenderedExport();

    expect(current.onFlatten()).toBe(false);
    expect(
      notifyToast.mock.calls.some((call) => /mask length/.test(String(call[0]))),
    ).toBe(true);
    expect(current.flattenResult).toBeNull();
  });

  it("ISO-UI-004 flattens the full mesh and then the active subset", () => {
    const session = tubeSession();
    const mask = maskFromFaces(8, [0]);
    const notifyToast = vi.fn();

    props = {
      session,
      meshLoadVersion: 1,
      patternRevision: 0,
      isolation: { active: false, mask, warnings: [] },
      cutStrokes: [],
      notifyToast,
    };
    useRenderedExport();
    expect(current.onFlatten()).toBe(true);
    expect(unfoldedFaceCount(current.flattenResult)).toBe(8);

    props = {
      ...props,
      isolation: { active: true, mask, warnings: [] },
    };
    useRenderedExport();
    expect(current.onFlatten()).toBe(true);
    expect(unfoldedFaceCount(current.flattenResult)).toBe(1);
  });

  it("toasts the flood sentence already on an active overlay", () => {
    const mesh = nonManifoldTripleEdge();
    const session = tubeSession(mesh);
    const flood = floodFromFace(mesh, session.topology, 0);
    expect(flood.warnings).toEqual([
      "Non-manifold edge 0,1 (3 incidents) treated as flood boundary.",
    ]);
    const mask = maskFromFaces(mesh.faceCount, flood.faces);
    const notifyToast = vi.fn();

    props = {
      session,
      meshLoadVersion: 1,
      patternRevision: 0,
      isolation: { active: true, mask, warnings: flood.warnings },
      cutStrokes: [],
      notifyToast,
    };
    useRenderedExport();

    expect(current.onFlatten()).toBe(true);
    expect(notifyToast).toHaveBeenCalledWith(flood.warnings[0], "warning");

    notifyToast.mockClear();
    props = {
      ...props,
      isolation: { active: true, mask, warnings: [] },
    };
    useRenderedExport();
    expect(current.onFlatten()).toBe(true);
    expect(notifyToast).not.toHaveBeenCalled();
    expect(
      notifyToast.mock.calls.some((call) =>
        /non-manifold/i.test(String(call[0])),
      ),
    ).toBe(false);
  });
});
