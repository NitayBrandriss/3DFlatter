"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { Vec3 } from "../../logic/cuts/types";
import type { MeshEditTool } from "../../state/meshEditTool";
import {
  displayToCanonical,
  type DisplayNormalization,
} from "../displayNormalization";
import {
  isAtCutStrokePointCap,
  shouldAppendCutSample,
} from "../cutDrawSampling";
import {
  canFinalizeDraft,
  isClosedClick,
  stripDblClickDuplicate,
  CUT_POLYLINE_CLOSE_RADIUS,
} from "./cutPolylineHelpers";
import type {
  DisplayVec3,
  InProgressPolylineHandle,
} from "./InProgressPolylineLine";

export type CutPolylineFinalizeResult = {
  kind: "add";
  points: Vec3[];
};

export type AddPointResult =
  | { status: "added" }
  | { status: "closed"; points: Vec3[] }
  | { status: "rejected" }
  | { status: "capped" }
  | { status: "ignored" };

export type CutPolylineDraftApi = {
  addPointFromHit: (
    displayLocal: DisplayVec3,
    normalization: DisplayNormalization,
  ) => AddPointResult;
  setHoverTip: (tip: DisplayVec3 | null) => void;
  finalize: () => CutPolylineFinalizeResult | null;
  finalizeFromDoubleClick: () => CutPolylineFinalizeResult | null;
  undoLast: () => void;
  cancel: () => void;
};

export function useCutPolylineDraft({
  lineRef,
  editTool,
  onCommit,
  onDraftActiveChange,
  onPointCapReached,
  closeRadius = CUT_POLYLINE_CLOSE_RADIUS,
}: {
  lineRef: RefObject<InProgressPolylineHandle | null>;
  editTool: MeshEditTool;
  onCommit: (points: Vec3[]) => void;
  onDraftActiveChange?: (active: boolean) => void;
  onPointCapReached?: () => void;
  closeRadius?: number;
}): {
  cutDraftActive: boolean;
  api: CutPolylineDraftApi;
} {
  const [cutDraftActive, setCutDraftActive] = useState(false);
  const modeRef = useRef<"idle" | "drafting">("idle");
  const placedDisplayRef = useRef<DisplayVec3[]>([]);
  const placedCanonicalRef = useRef<Vec3[]>([]);
  const lastPointerUpAddedRef = useRef(false);
  const activeRef = useRef(false);

  const setActive = useCallback(
    (active: boolean) => {
      if (activeRef.current === active) return;
      activeRef.current = active;
      setCutDraftActive(active);
      onDraftActiveChange?.(active);
    },
    [onDraftActiveChange],
  );

  const syncLine = useCallback(
    (tip: DisplayVec3 | null = null) => {
      lineRef.current?.setPlaced(placedDisplayRef.current);
      lineRef.current?.setPreviewTip(tip);
    },
    [lineRef],
  );

  const clearDraft = useCallback(() => {
    modeRef.current = "idle";
    placedDisplayRef.current = [];
    placedCanonicalRef.current = [];
    lastPointerUpAddedRef.current = false;
    lineRef.current?.clear();
    setActive(false);
  }, [lineRef, setActive]);

  const cancel = useCallback(() => {
    clearDraft();
  }, [clearDraft]);

  const commitPoints = useCallback(
    (points: Vec3[]): CutPolylineFinalizeResult => {
      const cloned = points.map((p) => ({ x: p.x, y: p.y, z: p.z }));
      clearDraft();
      onCommit(cloned);
      return { kind: "add", points: cloned };
    },
    [clearDraft, onCommit],
  );

  const finalize = useCallback((): CutPolylineFinalizeResult | null => {
    const points = placedCanonicalRef.current;
    if (!canFinalizeDraft(points.length)) return null;
    return commitPoints(points);
  }, [commitPoints]);

  const undoLast = useCallback(() => {
    if (placedDisplayRef.current.length === 0) return;
    placedDisplayRef.current = placedDisplayRef.current.slice(0, -1);
    placedCanonicalRef.current = placedCanonicalRef.current.slice(0, -1);
    lastPointerUpAddedRef.current = false;
    if (placedDisplayRef.current.length === 0) {
      clearDraft();
      return;
    }
    syncLine(null);
  }, [clearDraft, syncLine]);

  const finalizeFromDoubleClick =
    useCallback((): CutPolylineFinalizeResult | null => {
      const stripped = stripDblClickDuplicate(
        placedDisplayRef.current,
        placedCanonicalRef.current,
        lastPointerUpAddedRef.current,
      );
      placedDisplayRef.current = stripped.display;
      placedCanonicalRef.current = stripped.canonical;
      lastPointerUpAddedRef.current = false;
      if (placedDisplayRef.current.length === 0) {
        clearDraft();
        return null;
      }
      syncLine(null);
      return finalize();
    }, [clearDraft, finalize, syncLine]);

  const addPointFromHit = useCallback(
    (
      displayLocal: DisplayVec3,
      normalization: DisplayNormalization,
    ): AddPointResult => {
      if (editTool !== "cut") return { status: "ignored" };

      const placed = placedDisplayRef.current;
      const first = placed[0];
      if (
        first &&
        placed.length >= 2 &&
        isClosedClick(displayLocal, first, closeRadius)
      ) {
        const firstCanonical = placedCanonicalRef.current[0]!;
        placed.push({ x: first.x, y: first.y, z: first.z });
        placedCanonicalRef.current.push({
          x: firstCanonical.x,
          y: firstCanonical.y,
          z: firstCanonical.z,
        });
        lastPointerUpAddedRef.current = true;
        const points = placedCanonicalRef.current.map((p) => ({
          x: p.x,
          y: p.y,
          z: p.z,
        }));
        const result = commitPoints(points);
        return { status: "closed", points: result.points };
      }

      const prev = placed[placed.length - 1];
      if (!shouldAppendCutSample(prev, displayLocal)) {
        lastPointerUpAddedRef.current = false;
        return { status: "rejected" };
      }
      if (isAtCutStrokePointCap(placed.length)) {
        lastPointerUpAddedRef.current = false;
        onPointCapReached?.();
        return { status: "capped" };
      }

      const canonical = displayToCanonical(displayLocal, normalization);
      placed.push({
        x: displayLocal.x,
        y: displayLocal.y,
        z: displayLocal.z,
      });
      placedCanonicalRef.current.push({
        x: canonical.x,
        y: canonical.y,
        z: canonical.z,
      });
      modeRef.current = "drafting";
      lastPointerUpAddedRef.current = true;
      setActive(true);
      syncLine(null);
      return { status: "added" };
    },
    [
      closeRadius,
      commitPoints,
      editTool,
      onPointCapReached,
      setActive,
      syncLine,
    ],
  );

  const setHoverTip = useCallback(
    (tip: DisplayVec3 | null) => {
      if (modeRef.current !== "drafting") return;
      lineRef.current?.setPreviewTip(tip);
    },
    [lineRef],
  );

  // Leaving the cut tool discards the draft.
  useEffect(() => {
    if (editTool !== "cut") {
      cancel();
    }
  }, [cancel, editTool]);

  useEffect(() => {
    return () => {
      if (activeRef.current) {
        activeRef.current = false;
        onDraftActiveChange?.(false);
      }
    };
  }, [onDraftActiveChange]);

  useEffect(() => {
    if (editTool !== "cut") return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (event.key === "Escape") {
        cancel();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        finalize();
        return;
      }
      if (
        (event.key === "Backspace" || event.key === "Delete") &&
        modeRef.current === "drafting"
      ) {
        event.preventDefault();
        undoLast();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancel, editTool, finalize, undoLast]);

  const api = useMemo<CutPolylineDraftApi>(
    () => ({
      addPointFromHit,
      setHoverTip,
      finalize,
      finalizeFromDoubleClick,
      undoLast,
      cancel,
    }),
    [
      addPointFromHit,
      setHoverTip,
      finalize,
      finalizeFromDoubleClick,
      undoLast,
      cancel,
    ],
  );

  return { cutDraftActive, api };
}
