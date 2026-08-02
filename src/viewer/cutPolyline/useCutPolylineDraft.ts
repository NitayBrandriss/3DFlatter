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
import type { DisplayNormalization } from "../displayNormalization";
import {
  appendPolylineDraftPoint,
  canFinalizeDraft,
  stripDblClickDuplicate,
  takeCapToastNotification,
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

export type CutPolylineDraftUi = {
  active: boolean;
  canFinalize: boolean;
};

export function useCutPolylineDraft({
  lineRef,
  editTool,
  onCommit,
  onDraftUiChange,
  onPointCapReached,
  onFinalizeTooFewPoints,
}: {
  lineRef: RefObject<InProgressPolylineHandle | null>;
  editTool: MeshEditTool;
  onCommit: (points: Vec3[]) => void;
  onDraftUiChange?: (ui: CutPolylineDraftUi) => void;
  onPointCapReached?: () => void;
  onFinalizeTooFewPoints?: () => void;
}): {
  cutDraftActive: boolean;
  cutDraftCanFinalize: boolean;
  api: CutPolylineDraftApi;
} {
  const [cutDraftActive, setCutDraftActive] = useState(false);
  const [cutDraftCanFinalize, setCutDraftCanFinalize] = useState(false);
  const modeRef = useRef<"idle" | "drafting">("idle");
  const placedDisplayRef = useRef<DisplayVec3[]>([]);
  const placedCanonicalRef = useRef<Vec3[]>([]);
  const lastPointerUpAddedRef = useRef(false);
  const activeRef = useRef(false);
  const canFinalizeRef = useRef(false);
  const capToastShownRef = useRef(false);

  const setDraftUi = useCallback(
    (active: boolean, canFinalize: boolean) => {
      const activeChanged = activeRef.current !== active;
      const finalizeChanged = canFinalizeRef.current !== canFinalize;
      if (!activeChanged && !finalizeChanged) return;
      activeRef.current = active;
      canFinalizeRef.current = canFinalize;
      if (activeChanged) setCutDraftActive(active);
      if (finalizeChanged) setCutDraftCanFinalize(canFinalize);
      onDraftUiChange?.({ active, canFinalize });
    },
    [onDraftUiChange],
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
    capToastShownRef.current = false;
    lineRef.current?.clear();
    setDraftUi(false, false);
  }, [lineRef, setDraftUi]);

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
    if (!canFinalizeDraft(points.length)) {
      // Idle Enter with no draft stays silent; one-point draft gets feedback.
      if (points.length > 0) onFinalizeTooFewPoints?.();
      return null;
    }
    return commitPoints(points);
  }, [commitPoints, onFinalizeTooFewPoints]);

  const undoLast = useCallback(() => {
    if (placedDisplayRef.current.length === 0) return;
    placedDisplayRef.current = placedDisplayRef.current.slice(0, -1);
    placedCanonicalRef.current = placedCanonicalRef.current.slice(0, -1);
    lastPointerUpAddedRef.current = false;
    if (placedDisplayRef.current.length === 0) {
      clearDraft();
      return;
    }
    setDraftUi(
      true,
      canFinalizeDraft(placedDisplayRef.current.length),
    );
    syncLine(null);
  }, [clearDraft, setDraftUi, syncLine]);

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
        onFinalizeTooFewPoints?.();
        return null;
      }
      setDraftUi(
        true,
        canFinalizeDraft(placedDisplayRef.current.length),
      );
      syncLine(null);
      return finalize();
    }, [clearDraft, finalize, onFinalizeTooFewPoints, setDraftUi, syncLine]);

  const addPointFromHit = useCallback(
    (
      displayLocal: DisplayVec3,
      normalization: DisplayNormalization,
    ): AddPointResult => {
      if (editTool !== "cut") return { status: "ignored" };

      const result = appendPolylineDraftPoint(
        placedDisplayRef.current,
        placedCanonicalRef.current,
        displayLocal,
        normalization,
      );

      if (result.status === "rejected") {
        lastPointerUpAddedRef.current = false;
        return { status: "rejected" };
      }
      if (result.status === "capped") {
        lastPointerUpAddedRef.current = false;
        const toast = takeCapToastNotification(capToastShownRef.current);
        capToastShownRef.current = toast.shown;
        if (toast.notify) onPointCapReached?.();
        return { status: "capped" };
      }

      placedDisplayRef.current = result.display;
      placedCanonicalRef.current = result.canonical;
      modeRef.current = "drafting";
      lastPointerUpAddedRef.current = true;
      setDraftUi(
        true,
        canFinalizeDraft(result.display.length),
      );
      syncLine(null);
      return { status: "added" };
    },
    [editTool, onPointCapReached, setDraftUi, syncLine],
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
      if (activeRef.current || canFinalizeRef.current) {
        activeRef.current = false;
        canFinalizeRef.current = false;
        onDraftUiChange?.({ active: false, canFinalize: false });
      }
    };
  }, [onDraftUiChange]);

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

  return { cutDraftActive, cutDraftCanFinalize, api };
}
