"use client";

import * as THREE from "three";
import { useCallback, useEffect, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { EdgeKey, MeshModel } from "../logic/mesh/types";
import { resolvePick } from "../logic/seams/resolvePick";

const DRAG_THRESHOLD_PX = 5;

export function PickableMesh({
  geometry,
  displayMesh,
  wireframe,
  modelScale,
  seamMode,
  onEdgePick,
}: {
  geometry: THREE.BufferGeometry;
  /** Display-normalized mesh aligned with `geometry` positions for raycast resolve. */
  displayMesh: MeshModel;
  wireframe: boolean;
  modelScale: number;
  seamMode: boolean;
  onEdgePick: (edgeKey: EdgeKey) => void;
}) {
  const pointerDown = useRef<{ x: number; y: number } | null>(null);
  const displayMeshRef = useRef(displayMesh);

  useEffect(() => {
    displayMeshRef.current = displayMesh;
  }, [displayMesh]);

  const clearPointerDown = useCallback(() => {
    pointerDown.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!seamMode) return;
      pointerDown.current = {
        x: e.nativeEvent.clientX,
        y: e.nativeEvent.clientY,
      };
    },
    [seamMode],
  );

  const onPointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!seamMode || !pointerDown.current) {
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
    [clearPointerDown, onEdgePick, seamMode],
  );

  // VIEW-001: clear drag guard when pointer leaves mesh or is cancelled.
  useEffect(() => {
    if (!seamMode) {
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
  }, [clearPointerDown, seamMode]);

  return (
    <mesh
      geometry={geometry}
      scale={modelScale}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={clearPointerDown}
      onPointerLeave={clearPointerDown}
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
