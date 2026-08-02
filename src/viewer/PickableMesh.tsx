"use client";

import * as THREE from "three";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { EdgeKey, MeshModel } from "../logic/mesh/types";
import { resolvePick } from "../logic/seams/resolvePick";
import type { MeshEditTool } from "../state/meshEditTool";
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
  cutDraftApiRef,
}: {
  geometry: THREE.BufferGeometry;
  /** Display-normalized mesh aligned with `geometry` positions for raycast resolve. */
  displayMesh: MeshModel;
  wireframe: boolean;
  modelScale: number;
  editTool: MeshEditTool;
  normalization: DisplayNormalization;
  onEdgePick: (edgeKey: EdgeKey) => void;
  cutDraftApiRef: RefObject<CutPolylineDraftApi | null>;
}) {
  const pointerDown = useRef<{ x: number; y: number } | null>(null);
  const displayMeshRef = useRef(displayMesh);
  const normalizationRef = useRef(normalization);

  useEffect(() => {
    displayMeshRef.current = displayMesh;
  }, [displayMesh]);

  useEffect(() => {
    normalizationRef.current = normalization;
  }, [normalization]);

  const clearPointerDown = useCallback(() => {
    pointerDown.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (editTool === "none") return;
      pointerDown.current = {
        x: e.nativeEvent.clientX,
        y: e.nativeEvent.clientY,
      };
    },
    [editTool],
  );

  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (editTool !== "cut") return;
      const api = cutDraftApiRef.current;
      if (!api) return;

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

      if (editTool === "cut") {
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
      const resolved = resolvePick(displayMeshRef.current, e.faceIndex, {
        x: local.x,
        y: local.y,
        z: local.z,
      });

      if (resolved) {
        onEdgePick(resolved.edgeKey);
      }
    },
    [clearPointerDown, cutDraftApiRef, editTool, onEdgePick],
  );

  const onDoubleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (editTool !== "cut") return;
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
