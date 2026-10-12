"use client";

import * as THREE from "three";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { originalFaceIdForHit } from "../logic/isolation/maskGeometry";
import type { FloodCombineMode } from "../logic/isolation/types";
import type { EdgeKey, FaceIndex, MeshModel } from "../logic/mesh/types";
import { resolvePick } from "../logic/seams/resolvePick";
import { meshPointerAction, type MeshEditTool } from "../state/meshEditTool";
import type { DisplayNormalization } from "./displayNormalization";
import type { CutPolylineDraftApi } from "./cutPolyline/useCutPolylineDraft";

const DRAG_THRESHOLD_PX = 5;

export function PickableMesh({
  geometry,
  displayMesh,
  wireframe,
  modelScale,
  editTool,
  normalization,
  onEdgePick,
  onIsolationFlood,
  isolateFaceIds,
  cutDraftApiRef,
  meshRef,
}: {
  geometry: THREE.BufferGeometry;
  /** Display-normalized mesh aligned with `geometry` positions for raycast resolve. */
  displayMesh: MeshModel;
  wireframe: boolean;
  modelScale: number;
  editTool: MeshEditTool;
  normalization: DisplayNormalization;
  onEdgePick: (edgeKey: EdgeKey) => void;
  onIsolationFlood: (originalFaceIndex: FaceIndex, mode: FloodCombineMode) => void;
  /**
   * While isolation is active, Three.js `faceIndex` is the isolate-buffer
   * triangle. Null keeps the full-mesh index (Shift-add before confirm).
   */
  isolateFaceIds: readonly FaceIndex[] | null;
  cutDraftApiRef: RefObject<CutPolylineDraftApi | null>;
  meshRef: RefObject<THREE.Mesh | null>;
}) {
  const pointerDown = useRef<{ x: number; y: number } | null>(null);
  const displayMeshRef = useRef(displayMesh);
  const normalizationRef = useRef(normalization);
  const isolateFaceIdsRef = useRef(isolateFaceIds);
  const { controls } = useThree();

  useEffect(() => {
    displayMeshRef.current = displayMesh;
  }, [displayMesh]);

  useEffect(() => {
    normalizationRef.current = normalization;
  }, [normalization]);

  useEffect(() => {
    isolateFaceIdsRef.current = isolateFaceIds;
  }, [isolateFaceIds]);

  const clearPointerDown = useCallback(() => {
    pointerDown.current = null;
  }, []);

  const pivotToHit = useCallback(
    (worldPoint: THREE.Vector3) => {
      const orbit = controls as OrbitControlsImpl | null;
      if (!orbit || typeof orbit.target?.copy !== "function") return;
      orbit.target.copy(worldPoint);
      orbit.update();
    },
    [controls],
  );

  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      // Always track for Alt+click pivot; tool actions still gate on editTool.
      if (cutDraftApiRef.current?.isNodeDragging()) return;
      pointerDown.current = {
        x: e.nativeEvent.clientX,
        y: e.nativeEvent.clientY,
      };
    },
    [cutDraftApiRef],
  );

  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (editTool !== "cut") return;
      const api = cutDraftApiRef.current;
      if (!api || api.isNodeDragging()) return;

      if (e.faceIndex == null || !e.point) {
        api.setHoverTip(null);
        return;
      }
      const local = e.object.worldToLocal(e.point.clone());
      api.setHoverTip({ x: local.x, y: local.y, z: local.z });
    },
    [cutDraftApiRef, editTool],
  );

  const onPointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!pointerDown.current) {
        clearPointerDown();
        return;
      }

      const dx = e.nativeEvent.clientX - pointerDown.current.x;
      const dy = e.nativeEvent.clientY - pointerDown.current.y;
      clearPointerDown();

      if (dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
        return;
      }

      if (e.faceIndex == null || !e.point) return;

      const gesture = meshPointerAction(
        editTool,
        e.nativeEvent.shiftKey,
        e.nativeEvent.altKey,
      );
      if (gesture.type === "none") {
        e.stopPropagation();
        return;
      }
      if (gesture.type === "pivot") {
        e.stopPropagation();
        pivotToHit(e.point);
        return;
      }
      if (gesture.type === "flood") {
        e.stopPropagation();
        const faceId = originalFaceIdForHit(
          e.faceIndex,
          isolateFaceIdsRef.current,
        );
        if (faceId == null) return;
        onIsolationFlood(faceId, gesture.mode);
        return;
      }

      if (editTool === "none") return;

      if (editTool === "cut") {
        if (cutDraftApiRef.current?.isNodeDragging()) return;
        e.stopPropagation();
        const local = e.object.worldToLocal(e.point.clone());
        cutDraftApiRef.current?.addPointFromHit(
          { x: local.x, y: local.y, z: local.z },
          normalizationRef.current,
        );
        return;
      }

      if (editTool !== "seam") return;

      e.stopPropagation();

      const local = e.object.worldToLocal(e.point.clone());
      const faceId = originalFaceIdForHit(
        e.faceIndex,
        isolateFaceIdsRef.current,
      );
      if (faceId == null) return;
      const resolved = resolvePick(displayMeshRef.current, faceId, {
        x: local.x,
        y: local.y,
        z: local.z,
      });

      if (resolved) {
        onEdgePick(resolved.edgeKey);
      }
    },
    [
      clearPointerDown,
      cutDraftApiRef,
      editTool,
      onEdgePick,
      onIsolationFlood,
      pivotToHit,
    ],
  );

  const onDoubleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (editTool !== "cut") return;
      if (cutDraftApiRef.current?.isNodeDragging()) return;
      e.stopPropagation();
      cutDraftApiRef.current?.finalizeFromDoubleClick();
    },
    [cutDraftApiRef, editTool],
  );

  useEffect(() => {
    if (editTool === "none") {
      clearPointerDown();
      return;
    }

    const onDocumentPointerUp = () => {
      clearPointerDown();
    };

    document.addEventListener("pointerup", onDocumentPointerUp);
    document.addEventListener("pointercancel", onDocumentPointerUp);
    return () => {
      document.removeEventListener("pointerup", onDocumentPointerUp);
      document.removeEventListener("pointercancel", onDocumentPointerUp);
    };
  }, [clearPointerDown, editTool]);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      scale={modelScale}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
      onPointerCancel={() => {
        clearPointerDown();
        cutDraftApiRef.current?.setHoverTip(null);
      }}
      onPointerLeave={() => {
        // Keep pending click: silhouette leave/re-enter must not cancel place
        // (POLYCUT-004). Tip clears; pointerup / cancel / document up still clear down.
        if (editTool === "cut") {
          cutDraftApiRef.current?.setHoverTip(null);
        }
      }}
    >
      <meshStandardMaterial
        color="#cbd5e1"
        metalness={0.05}
        roughness={0.9}
        wireframe={wireframe}
      />
    </mesh>
  );
}
