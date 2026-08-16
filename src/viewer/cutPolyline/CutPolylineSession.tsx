"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import type * as THREE from "three";
import type { Vec3 } from "../../logic/cuts/types";
import type { MeshModel } from "../../logic/mesh/types";
import type { MeshEditTool } from "../../state/meshEditTool";
import {
  DraftVertexMarkers,
  type DraftVertexMarkersHandle,
} from "./DraftVertexMarkers";
import {
  InProgressPolylineLine,
  type InProgressPolylineHandle,
} from "./InProgressPolylineLine";
import { clientToNdc, raycastDisplayMesh } from "./raycastDisplayMesh";
import {
  useCutPolylineDraft,
  type CutPolylineDraftApi,
  type CutPolylineDraftUi,
} from "./useCutPolylineDraft";

const DRAG_THRESHOLD_PX = 5;

export type CutPolylineActions = Pick<
  CutPolylineDraftApi,
  "finalize" | "cancel"
>;

export function CutPolylineSession({
  mesh,
  editTool,
  modelScale,
  onCommit,
  onDraftUiChange,
  onPointCapReached,
  onFinalizeTooFewPoints,
  onOrbitEnabledChange,
  pickableMeshRef,
  draftApiRef,
  actionsRef,
}: {
  mesh: MeshModel;
  editTool: MeshEditTool;
  modelScale: number;
  onCommit: (points: Vec3[]) => void;
  onDraftUiChange?: (ui: CutPolylineDraftUi) => void;
  onPointCapReached?: () => void;
  onFinalizeTooFewPoints?: () => void;
  onOrbitEnabledChange: (enabled: boolean) => void;
  pickableMeshRef: RefObject<THREE.Mesh | null>;
  draftApiRef: RefObject<CutPolylineDraftApi | null>;
  actionsRef?: RefObject<CutPolylineActions | null>;
}) {
  const { gl, camera } = useThree();
  const lineRef = useRef<InProgressPolylineHandle | null>(null);
  const markersRef = useRef<DraftVertexMarkersHandle | null>(null);
  const gestureRef = useRef<{
    index: number;
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  const { api } = useCutPolylineDraft({
    mesh,
    lineRef,
    markersRef,
    editTool,
    onCommit,
    onDraftUiChange,
    onPointCapReached,
    onFinalizeTooFewPoints,
    onOrbitEnabledChange,
  });

  useEffect(() => {
    draftApiRef.current = api;
    return () => {
      draftApiRef.current = null;
    };
  }, [api, draftApiRef]);

  useEffect(() => {
    if (!actionsRef) return;
    actionsRef.current = {
      finalize: () => api.finalize(),
      cancel: () => {
        api.cancel();
      },
    };
    return () => {
      actionsRef.current = null;
    };
  }, [actionsRef, api]);

  useEffect(() => {
    const el = gl.domElement;

    const onMove = (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      const dx = event.clientX - gesture.startX;
      const dy = event.clientY - gesture.startY;
      if (
        !gesture.moved &&
        dx * dx + dy * dy <= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX
      ) {
        return;
      }
      gesture.moved = true;
      const ndc = clientToNdc(
        event.clientX,
        event.clientY,
        el.getBoundingClientRect(),
      );
      const pickMesh = pickableMeshRef.current;
      if (!ndc || !pickMesh) return;
      const hit = raycastDisplayMesh(camera, pickMesh, ndc);
      if (hit) api.applyNodeDragHit(hit);
    };

    const onUp = (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      try {
        el.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
      const { index, moved } = gesture;
      gestureRef.current = null;
      api.endNodeDrag();
      if (!moved && index === 0) {
        api.closeOnFirstMarkerClick();
      }
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [api, camera, gl, pickableMeshRef]);

  const onMarkerPointerDown = useCallback(
    (index: number, event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      try {
        gl.domElement.setPointerCapture(event.pointerId);
      } catch {
        /* capture unsupported */
      }
      gestureRef.current = {
        index,
        pointerId: event.pointerId,
        startX: event.nativeEvent.clientX,
        startY: event.nativeEvent.clientY,
        moved: false,
      };
      api.beginNodeDrag(index);
    },
    [api, gl],
  );

  return (
    <>
      <InProgressPolylineLine ref={lineRef} modelScale={modelScale} />
      <DraftVertexMarkers
        ref={markersRef}
        modelScale={modelScale}
        onMarkerPointerDown={onMarkerPointerDown}
      />
    </>
  );
}
