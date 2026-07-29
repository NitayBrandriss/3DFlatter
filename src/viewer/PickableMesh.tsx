"use client";

import * as THREE from "three";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import type { Vec3 } from "../logic/cuts/types";
import type { EdgeKey, MeshModel } from "../logic/mesh/types";
import { resolvePick } from "../logic/seams/resolvePick";
import type { MeshEditTool } from "../state/meshEditTool";
import {
  displayToCanonical,
  type DisplayNormalization,
} from "./displayNormalization";
import type { InProgressCutStrokeHandle } from "./InProgressCutStrokeLine";

const DRAG_THRESHOLD_PX = 5;
/** Min display-space distance between consecutive cut samples. */
const MIN_SAMPLE_DIST_SQ = 0.015 * 0.015;
const MAX_STROKE_POINTS = 512;

export function PickableMesh({
  geometry,
  displayMesh,
  wireframe,
  modelScale,
  editTool,
  normalization,
  onEdgePick,
  onCutStrokeCommit,
  inProgressLineRef,
  onOrbitEnabledChange,
}: {
  geometry: THREE.BufferGeometry;
  /** Display-normalized mesh aligned with `geometry` positions for raycast resolve. */
  displayMesh: MeshModel;
  wireframe: boolean;
  modelScale: number;
  editTool: MeshEditTool;
  normalization: DisplayNormalization;
  onEdgePick: (edgeKey: EdgeKey) => void;
  onCutStrokeCommit: (points: Vec3[]) => void;
  inProgressLineRef: RefObject<InProgressCutStrokeHandle | null>;
  onOrbitEnabledChange: (enabled: boolean) => void;
}) {
  const { gl } = useThree();
  const pointerDown = useRef<{ x: number; y: number } | null>(null);
  const displayMeshRef = useRef(displayMesh);
  const drawing = useRef(false);
  const displayPoints = useRef<{ x: number; y: number; z: number }[]>([]);
  const canonicalPoints = useRef<Vec3[]>([]);

  useEffect(() => {
    displayMeshRef.current = displayMesh;
  }, [displayMesh]);

  const clearPointerDown = useCallback(() => {
    pointerDown.current = null;
  }, []);

  const stopDrawing = useCallback(
    (commit: boolean) => {
      if (!drawing.current) return;
      drawing.current = false;
      onOrbitEnabledChange(true);
      const points = canonicalPoints.current;
      displayPoints.current = [];
      canonicalPoints.current = [];
      inProgressLineRef.current?.clear();
      if (commit && points.length >= 2) {
        onCutStrokeCommit(points.map((p) => ({ ...p })));
      }
    },
    [inProgressLineRef, onCutStrokeCommit, onOrbitEnabledChange],
  );

  const appendSample = useCallback(
    (displayLocal: { x: number; y: number; z: number }) => {
      const prev = displayPoints.current[displayPoints.current.length - 1];
      if (prev) {
        const dx = displayLocal.x - prev.x;
        const dy = displayLocal.y - prev.y;
        const dz = displayLocal.z - prev.z;
        if (dx * dx + dy * dy + dz * dz < MIN_SAMPLE_DIST_SQ) return;
      }
      if (displayPoints.current.length >= MAX_STROKE_POINTS) return;

      displayPoints.current.push(displayLocal);
      const canonical = displayToCanonical(displayLocal, normalization);
      canonicalPoints.current.push({
        x: canonical.x,
        y: canonical.y,
        z: canonical.z,
      });
      inProgressLineRef.current?.setPoints(displayPoints.current);
    },
    [inProgressLineRef, normalization],
  );

  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (editTool === "none") return;

      if (editTool === "seam") {
        pointerDown.current = {
          x: e.nativeEvent.clientX,
          y: e.nativeEvent.clientY,
        };
        return;
      }

      // cut
      if (e.faceIndex == null || !e.point) return;
      e.stopPropagation();
      try {
        gl.domElement.setPointerCapture(e.pointerId);
      } catch {
        /* capture unsupported */
      }

      drawing.current = true;
      onOrbitEnabledChange(false);

      const local = e.object.worldToLocal(e.point.clone());
      displayPoints.current = [];
      canonicalPoints.current = [];
      appendSample({ x: local.x, y: local.y, z: local.z });
    },
    [appendSample, editTool, gl, onOrbitEnabledChange],
  );

  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (editTool !== "cut" || !drawing.current) return;
      if (e.faceIndex == null || !e.point) return;
      e.stopPropagation();
      const local = e.object.worldToLocal(e.point.clone());
      appendSample({ x: local.x, y: local.y, z: local.z });
    },
    [appendSample, editTool],
  );

  const onPointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (editTool === "cut") {
        if (drawing.current) {
          e.stopPropagation();
          try {
            gl.domElement.releasePointerCapture(e.pointerId);
          } catch {
            /* already released */
          }
          stopDrawing(true);
        }
        return;
      }

      if (editTool !== "seam" || !pointerDown.current) {
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
    [clearPointerDown, editTool, gl, onEdgePick, stopDrawing],
  );

  // Clear guards when tool changes or pointer is cancelled globally.
  useEffect(() => {
    if (editTool === "none") {
      clearPointerDown();
      stopDrawing(false);
      return;
    }

    const onDocumentPointerUp = () => {
      if (drawing.current) {
        stopDrawing(true);
      } else {
        clearPointerDown();
      }
    };

    document.addEventListener("pointerup", onDocumentPointerUp);
    document.addEventListener("pointercancel", onDocumentPointerUp);
    return () => {
      document.removeEventListener("pointerup", onDocumentPointerUp);
      document.removeEventListener("pointercancel", onDocumentPointerUp);
    };
  }, [clearPointerDown, editTool, stopDrawing]);

  return (
    <mesh
      geometry={geometry}
      scale={modelScale}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        clearPointerDown();
        stopDrawing(false);
      }}
      onPointerLeave={() => {
        if (editTool === "seam") clearPointerDown();
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
