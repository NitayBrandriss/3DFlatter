import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as flattenModule from "@/logic/cuts/flattenWithCutStrokes";
import type { CutStroke } from "@/logic/cuts/types";
import { createFaceMask, maskFromFaces } from "@/logic/isolation/faceMask";
import { openTube } from "@/logic/isolation/testMeshes";
import type { FaceMask } from "@/logic/isolation/types";
import { buildTopology } from "@/logic/mesh/buildTopology";
import type { UnfoldMeshResult } from "@/logic/mesh/types";
import { createSeamRegistry } from "@/logic/seams/seamRegistry";
import type { MeshSession } from "@/state/meshSessionStore";
import { useFlattenExport } from "./useFlattenExport";

type NotifyToast = (text: string, tone?: "info" | "warning") => void;

type FlattenProps = {
  session: MeshSession | null;
  meshLoadVersion: number;
  patternRevision: number;
  isolation: { active: boolean; mask: FaceMask };
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

const cleanUnfold: UnfoldMeshResult = {
  islands: [],
  bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  seamSegments: [],
  collisions: [],
  tears: [],
};

function tubeSession(): MeshSession {
  const mesh = openTube(2, 4);
  return {
    mesh,
    topology: buildTopology(mesh),
    seams: createSeamRegistry(),
    fileName: "tube.obj",
  };
}

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

  it("toasts a skipped isolate stroke before the materialize warning", () => {
    const session = tubeSession();
    const notifyToast = vi.fn();
    vi.spyOn(flattenModule, "flattenWithCutStrokes").mockReturnValue({
      unfold: cleanUnfold,
      materializeWarnings: ["Skipped segment on stroke a."],
      openLoops: [],
      skippedStrokes: [{ id: "cross", relation: "crossing" }],
      appliedSeams: session.seams.seams,
      materializedStrokeIds: [],
      flattenMesh: session.mesh,
    });

    props = {
      session,
      meshLoadVersion: 1,
      patternRevision: 0,
      isolation: {
        active: false,
        mask: createFaceMask(session.mesh.faceCount),
      },
      cutStrokes: [],
      notifyToast,
    };
    useRenderedExport();

    expect(current.onFlatten()).toBe(true);
    expect(notifyToast.mock.calls).toEqual([
      ["Skipped 1 cut stroke not wholly inside the isolate.", "warning"],
      ["Skipped segment on stroke a.", "warning"],
    ]);
  });

  it("clears the snapshot when a confirmed empty isolate throws", () => {
    const session = tubeSession();
    const notifyToast = vi.fn();
    const mask = createFaceMask(session.mesh.faceCount);

    props = {
      session,
      meshLoadVersion: 1,
      patternRevision: 0,
      isolation: { active: false, mask },
      cutStrokes: [],
      notifyToast,
    };
    useRenderedExport();
    expect(current.onFlatten()).toBe(true);
    expect(current.flattenResult).not.toBeNull();

    props = {
      ...props,
      isolation: { active: true, mask },
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
      isolation: { active: false, mask },
    };
    useRenderedExport();
    expect(current.flattenResult).toBeNull();
  });

  it("forwards the active isolation mask into flattenWithCutStrokes", () => {
    const session = tubeSession();
    const notifyToast = vi.fn();
    const mask = maskFromFaces(session.mesh.faceCount, [0]);
    const spy = vi.spyOn(flattenModule, "flattenWithCutStrokes").mockReturnValue({
      unfold: cleanUnfold,
      materializeWarnings: [],
      openLoops: [],
      skippedStrokes: [],
      appliedSeams: session.seams.seams,
      materializedStrokeIds: [],
      flattenMesh: session.mesh,
    });

    props = {
      session,
      meshLoadVersion: 1,
      patternRevision: 0,
      isolation: { active: true, mask },
      cutStrokes: [],
      notifyToast,
    };
    useRenderedExport();
    current.onFlatten();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0].isolation).toEqual({ active: true, mask });
    expect(mask[0]).toBe(1);
    expect(Array.from(mask).some((bit, index) => index > 0 && bit === 0)).toBe(
      true,
    );
  });
});
