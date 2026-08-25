"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { CutStroke, Vec3 } from "../../logic/cuts/types";
import type { MeshModel } from "../../logic/mesh/types";
import type { MeshEditTool } from "../../state/meshEditTool";
import {
  canonicalToDisplay,
  type DisplayNormalization,
} from "../displayNormalization";
import {
  appendPolylineDraftPoint,
  canFinalizeDraft,
  closePolylineByDuplicatingFirst,
  idlePolylineDraft,
  isExactlyClosedPolyline,
  stripDblClickDuplicate,
  takeCapToastNotification,
  writePlacedTwin,
} from "./cutPolylineHelpers";
import {
  appendLastSegmentDisplayPath,
  tessellateDraftDisplayPath,
} from "./tessellateDraftDisplayPath";
import type { DraftVertexMarkersHandle } from "./DraftVertexMarkers";
import type {
  DisplayVec3,
  InProgressPolylineHandle,
} from "./InProgressPolylineLine";

export type CutPolylineFinalizeResult =
  | { kind: "add"; points: Vec3[] }
  | { kind: "update"; id: string; points: Vec3[] };

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
  /** Slice B: click first-vertex marker → closed polyline commit. */
  closeOnFirstMarkerClick: () => CutPolylineFinalizeResult | null;
  enterEditCommitted: (
    stroke: CutStroke,
    normalization: DisplayNormalization,
  ) => void;
  beginNodeDrag: (index: number) => void;
  applyNodeDragHit: (displayLocal: DisplayVec3) => void;
  endNodeDrag: () => void;
  isNodeDragging: () => boolean;
  undoLast: () => void;
  cancel: () => void;
};

export type CutPolylineDraftUi = {
  active: boolean;
  canFinalize: boolean;
  editingStrokeId: string | null;
};

function isLiveMode(
  mode: "idle" | "drafting" | "editingCommitted",
): boolean {
  return mode === "drafting" || mode === "editingCommitted";
}

export function useCutPolylineDraft({
  mesh,
  lineRef,
  markersRef,
  editTool,
  onFinalize,
  onDraftUiChange,
  onPointCapReached,
  onFinalizeTooFewPoints,
  onOrbitEnabledChange,
}: {
  mesh: MeshModel;
  lineRef: RefObject<InProgressPolylineHandle | null>;
  markersRef: RefObject<DraftVertexMarkersHandle | null>;
  editTool: MeshEditTool;
  onFinalize: (result: CutPolylineFinalizeResult) => void;
  onDraftUiChange?: (ui: CutPolylineDraftUi) => void;
  onPointCapReached?: () => void;
  onFinalizeTooFewPoints?: () => void;
  onOrbitEnabledChange?: (enabled: boolean) => void;
}): {
  cutDraftActive: boolean;
  cutDraftCanFinalize: boolean;
  api: CutPolylineDraftApi;
} {
  const [cutDraftActive, setCutDraftActive] = useState(false);
  const [cutDraftCanFinalize, setCutDraftCanFinalize] = useState(false);
  const modeRef = useRef<"idle" | "drafting" | "editingCommitted">("idle");
  const placedDisplayRef = useRef<DisplayVec3[]>([]);
  const placedCanonicalRef = useRef<Vec3[]>([]);
  /** Dense surface-hug path for the placed overlay (incremental on place). */
  const placedDisplayPathRef = useRef<DisplayVec3[]>([]);
  const lastPointerUpAddedRef = useRef(false);
  const activeRef = useRef(false);
  const canFinalizeRef = useRef(false);
  const editingUiRef = useRef<string | null>(null);
  const capToastShownRef = useRef(false);
  const normalizationRef = useRef<DisplayNormalization | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const pairClosedOnDragRef = useRef(false);
  const editingStrokeIdRef = useRef<string | null>(null);
  const onDraftUiChangeRef = useRef(onDraftUiChange);

  useEffect(() => {
    onDraftUiChangeRef.current = onDraftUiChange;
  }, [onDraftUiChange]);

  const setDraftUi = useCallback((active: boolean, canFinalize: boolean) => {
    const editingStrokeId = active ? editingStrokeIdRef.current : null;
    const activeChanged = activeRef.current !== active;
    const finalizeChanged = canFinalizeRef.current !== canFinalize;
    const editingChanged = editingUiRef.current !== editingStrokeId;
    if (!activeChanged && !finalizeChanged && !editingChanged) return;
    activeRef.current = active;
    canFinalizeRef.current = canFinalize;
    editingUiRef.current = editingStrokeId;
    if (activeChanged) setCutDraftActive(active);
    if (finalizeChanged) setCutDraftCanFinalize(canFinalize);
    onDraftUiChangeRef.current?.({ active, canFinalize, editingStrokeId });
  }, []);

  /** Full surface-hug rebuild (undo, drag-end, enter-edit). */
  const tessellatePlacedOverlay = useCallback(
    (recomputeBounds = true) => {
      markersRef.current?.setPositions(placedDisplayRef.current);
      lineRef.current?.setPreviewTip(null);

      const norm = normalizationRef.current;
      if (!norm) {
        placedDisplayPathRef.current = placedDisplayRef.current.map((p) => ({
          x: p.x,
          y: p.y,
          z: p.z,
        }));
        lineRef.current?.setPlaced(placedDisplayRef.current, recomputeBounds);
        return;
      }

      const linePoints = tessellateDraftDisplayPath(
        mesh,
        placedCanonicalRef.current,
        null,
        norm,
      );
      placedDisplayPathRef.current = linePoints;
      lineRef.current?.setPlaced(linePoints, recomputeBounds);
    },
    [lineRef, markersRef, mesh],
  );

  /**
   * Place path: tessellate only the newest sparse segment and append.
   * Keeps the overlay surface-hugging without recomputing prior segments.
   */
  const appendPlacedOverlaySegment = useCallback(() => {
    markersRef.current?.setPositions(placedDisplayRef.current);
    lineRef.current?.setPreviewTip(null);

    const norm = normalizationRef.current;
    const canon = placedCanonicalRef.current;
    if (!norm || canon.length < 2) {
      placedDisplayPathRef.current = placedDisplayRef.current.map((p) => ({
        x: p.x,
        y: p.y,
        z: p.z,
      }));
      lineRef.current?.setPlaced(placedDisplayRef.current, true);
      return;
    }

    const linePoints = appendLastSegmentDisplayPath(
      mesh,
      placedDisplayPathRef.current,
      canon[canon.length - 2]!,
      canon[canon.length - 1]!,
      norm,
    );
    placedDisplayPathRef.current = linePoints;
    lineRef.current?.setPlaced(linePoints, true);
  }, [lineRef, markersRef, mesh]);

  /** Straight display-space chords while a node is dragged (tessellate on pointer-up). */
  const showSparseOverlay = useCallback(() => {
    markersRef.current?.setPositions(placedDisplayRef.current);
    lineRef.current?.setPreviewTip(null);
    lineRef.current?.setPlaced(placedDisplayRef.current, false);
  }, [lineRef, markersRef]);

  const clearDraft = useCallback(() => {
    modeRef.current = "idle";
    const idle = idlePolylineDraft();
    placedDisplayRef.current = idle.display;
    placedCanonicalRef.current = idle.canonical;
    placedDisplayPathRef.current = [];
    editingStrokeIdRef.current = idle.editingStrokeId;
    lastPointerUpAddedRef.current = false;
    capToastShownRef.current = false;
    normalizationRef.current = null;
    dragIndexRef.current = null;
    pairClosedOnDragRef.current = false;
    lineRef.current?.clear();
    markersRef.current?.clear();
    onOrbitEnabledChange?.(true);
    setDraftUi(false, false);
  }, [lineRef, markersRef, onOrbitEnabledChange, setDraftUi]);

  const cancel = useCallback(() => {
    clearDraft();
  }, [clearDraft]);

  const commitPoints = useCallback(
    (points: Vec3[]): CutPolylineFinalizeResult => {
      const cloned = points.map((p) => ({ x: p.x, y: p.y, z: p.z }));
      const editingId = editingStrokeIdRef.current;
      clearDraft();
      const result: CutPolylineFinalizeResult = editingId
        ? { kind: "update", id: editingId, points: cloned }
        : { kind: "add", points: cloned };
      onFinalize(result);
      return result;
    },
    [clearDraft, onFinalize],
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
    if (dragIndexRef.current != null) return;
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
    tessellatePlacedOverlay();
  }, [clearDraft, setDraftUi, tessellatePlacedOverlay]);

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
      tessellatePlacedOverlay();
      return finalize();
    }, [clearDraft, finalize, onFinalizeTooFewPoints, setDraftUi, tessellatePlacedOverlay]);

  const closeOnFirstMarkerClick =
    useCallback((): CutPolylineFinalizeResult | null => {
      if (editTool !== "cut" || !isLiveMode(modeRef.current)) return null;
      if (dragIndexRef.current != null) return null;
      const closed = closePolylineByDuplicatingFirst(
        placedDisplayRef.current,
        placedCanonicalRef.current,
      );
      if (!closed) {
        if (placedCanonicalRef.current.length > 0) onFinalizeTooFewPoints?.();
        return null;
      }
      lastPointerUpAddedRef.current = false;
      return commitPoints(closed.canonical);
    }, [commitPoints, editTool, onFinalizeTooFewPoints]);

  const enterEditCommitted = useCallback(
    (stroke: CutStroke, normalization: DisplayNormalization) => {
      if (editTool !== "cut") return;
      if (stroke.points.length < 2) return;
      if (dragIndexRef.current != null) return;
      if (modeRef.current === "drafting") return;
      if (editingStrokeIdRef.current === stroke.id) return;

      editingStrokeIdRef.current = stroke.id;
      modeRef.current = "editingCommitted";
      placedCanonicalRef.current = stroke.points.map((p) => ({
        x: p.x,
        y: p.y,
        z: p.z,
      }));
      placedDisplayRef.current = stroke.points.map((p) => {
        const d = canonicalToDisplay(p, normalization);
        return { x: d.x, y: d.y, z: d.z };
      });
      normalizationRef.current = normalization;
      lastPointerUpAddedRef.current = false;
      capToastShownRef.current = false;
      setDraftUi(true, canFinalizeDraft(placedDisplayRef.current.length));
      tessellatePlacedOverlay();
    },
    [editTool, setDraftUi, tessellatePlacedOverlay],
  );

  const beginNodeDrag = useCallback(
    (index: number) => {
      if (editTool !== "cut" || !isLiveMode(modeRef.current)) return;
      if (index < 0 || index >= placedDisplayRef.current.length) return;
      dragIndexRef.current = index;
      pairClosedOnDragRef.current = isExactlyClosedPolyline(
        placedDisplayRef.current,
      );
      lastPointerUpAddedRef.current = false;
      onOrbitEnabledChange?.(false);
      showSparseOverlay();
    },
    [editTool, onOrbitEnabledChange, showSparseOverlay],
  );

  const applyNodeDragHit = useCallback(
    (displayLocal: DisplayVec3) => {
      const index = dragIndexRef.current;
      const norm = normalizationRef.current;
      if (index == null || !norm) return;
      writePlacedTwin(
        placedDisplayRef.current,
        placedCanonicalRef.current,
        index,
        displayLocal,
        norm,
        pairClosedOnDragRef.current,
      );
      showSparseOverlay();
    },
    [showSparseOverlay],
  );

  const endNodeDrag = useCallback(() => {
    if (dragIndexRef.current == null) {
      onOrbitEnabledChange?.(true);
      return;
    }
    dragIndexRef.current = null;
    pairClosedOnDragRef.current = false;
    tessellatePlacedOverlay(true);
    onOrbitEnabledChange?.(true);
  }, [onOrbitEnabledChange, tessellatePlacedOverlay]);

  const isNodeDragging = useCallback(() => dragIndexRef.current != null, []);

  const addPointFromHit = useCallback(
    (
      displayLocal: DisplayVec3,
      normalization: DisplayNormalization,
    ): AddPointResult => {
      if (editTool !== "cut") return { status: "ignored" };
      if (dragIndexRef.current != null) return { status: "ignored" };

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
      normalizationRef.current = normalization;
      if (modeRef.current !== "editingCommitted") {
        modeRef.current = "drafting";
      }
      lastPointerUpAddedRef.current = true;
      setDraftUi(
        true,
        canFinalizeDraft(result.display.length),
      );
      appendPlacedOverlaySegment();
      return { status: "added" };
    },
    [appendPlacedOverlaySegment, editTool, onPointCapReached, setDraftUi],
  );

  const setHoverTip = useCallback(
    (tip: DisplayVec3 | null) => {
      // POLYCUT-D-003 accepted: tip also runs in editingCommitted as append-at-end preview.
      // Hover rubber-band is a display-space chord (not a surface walk) so dense
      // meshes stay interactive; tessellate on place / undo / drag-end.
      if (!isLiveMode(modeRef.current)) return;
      if (dragIndexRef.current != null) return;
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

  // Report idle only on true unmount. A new onDraftUiChange identity is not an
  // unmount — treating it as one hid the viewport toolbar after the first vertex.
  useEffect(() => {
    return () => {
      if (activeRef.current || canFinalizeRef.current) {
        activeRef.current = false;
        canFinalizeRef.current = false;
        onDraftUiChangeRef.current?.({
          active: false,
          canFinalize: false,
          editingStrokeId: null,
        });
      }
    };
  }, []);

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
        isLiveMode(modeRef.current) &&
        dragIndexRef.current == null
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
      closeOnFirstMarkerClick,
      enterEditCommitted,
      beginNodeDrag,
      applyNodeDragHit,
      endNodeDrag,
      isNodeDragging,
      undoLast,
      cancel,
    }),
    [
      addPointFromHit,
      setHoverTip,
      finalize,
      finalizeFromDoubleClick,
      closeOnFirstMarkerClick,
      enterEditCommitted,
      beginNodeDrag,
      applyNodeDragHit,
      endNodeDrag,
      isNodeDragging,
      undoLast,
      cancel,
    ],
  );

  return { cutDraftActive, cutDraftCanFinalize, api };
}
