"use client";

import * as THREE from "three";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { DisplayVec3 } from "./InProgressPolylineLine";

const MARKER_RADIUS = 0.028;
const FIRST_MARKER_RADIUS = 0.038;
const MARKER_COLOR = "#7dd3fc";
const FIRST_MARKER_COLOR = "#fbbf24";
const DRAG_THRESHOLD_PX = 5;

export type DraftVertexMarkersHandle = {
  setPositions(points: readonly DisplayVec3[]): void;
  updatePosition(index: number, point: DisplayVec3): void;
  clear(): void;
};

/**
 * Draft polyline vertices as spheres (display space). Positions update
 * imperatively; only the first marker is pickable (Slice B close-loop).
 * Remaining markers have raycast disabled until Slice C drag.
 */
export const DraftVertexMarkers = forwardRef<
  DraftVertexMarkersHandle,
  {
    modelScale: number;
    onFirstMarkerClick: () => void;
  }
>(function DraftVertexMarkers({ modelScale, onFirstMarkerClick }, ref) {
  const [count, setCount] = useState(0);
  const pointsRef = useRef<DisplayVec3[]>([]);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const onFirstClickRef = useRef(onFirstMarkerClick);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    onFirstClickRef.current = onFirstMarkerClick;
  }, [onFirstMarkerClick]);

  useLayoutEffect(() => {
    const points = pointsRef.current;
    for (let i = 0; i < count; i++) {
      const mesh = meshRefs.current[i];
      const p = points[i];
      if (!mesh || !p) continue;
      mesh.position.set(p.x, p.y, p.z);
      mesh.visible = true;
    }
  }, [count]);

  useImperativeHandle(
    ref,
    () => ({
      setPositions(points: readonly DisplayVec3[]) {
        pointsRef.current = points.map((p) => ({ x: p.x, y: p.y, z: p.z }));
        const nextCount = points.length;
        if (nextCount === count) {
          for (let i = 0; i < nextCount; i++) {
            const mesh = meshRefs.current[i];
            const p = pointsRef.current[i]!;
            if (mesh) mesh.position.set(p.x, p.y, p.z);
          }
          return;
        }
        setCount(nextCount);
      },
      updatePosition(index: number, point: DisplayVec3) {
        if (index < 0 || index >= pointsRef.current.length) return;
        pointsRef.current[index] = { x: point.x, y: point.y, z: point.z };
        const mesh = meshRefs.current[index];
        if (mesh) mesh.position.set(point.x, point.y, point.z);
      },
      clear() {
        pointsRef.current = [];
        setCount(0);
      },
    }),
    [count],
  );

  const onFirstPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    pointerDownRef.current = {
      x: e.nativeEvent.clientX,
      y: e.nativeEvent.clientY,
    };
  };

  const onFirstPointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!pointerDownRef.current) return;
    const dx = e.nativeEvent.clientX - pointerDownRef.current.x;
    const dy = e.nativeEvent.clientY - pointerDownRef.current.y;
    pointerDownRef.current = null;
    if (dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
    onFirstClickRef.current();
  };

  return (
    <group scale={modelScale}>
      {Array.from({ length: count }, (_, index) => {
        const isFirst = index === 0;
        return (
          <mesh
            key={index}
            ref={(mesh) => {
              meshRefs.current[index] = mesh;
            }}
            raycast={isFirst ? undefined : () => undefined}
            onPointerDown={isFirst ? onFirstPointerDown : undefined}
            onPointerUp={isFirst ? onFirstPointerUp : undefined}
            onPointerCancel={
              isFirst
                ? () => {
                    pointerDownRef.current = null;
                  }
                : undefined
            }
          >
            <sphereGeometry
              args={[isFirst ? FIRST_MARKER_RADIUS : MARKER_RADIUS, 16, 12]}
            />
            <meshBasicMaterial
              color={isFirst ? FIRST_MARKER_COLOR : MARKER_COLOR}
              depthTest={false}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
});
