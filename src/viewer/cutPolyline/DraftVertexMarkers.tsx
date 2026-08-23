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
import {
  draftMarkerCount,
  isExactlyClosedPolyline,
} from "./cutPolylineHelpers";
import type { DisplayVec3 } from "./InProgressPolylineLine";

const MARKER_RADIUS = 0.028;
const FIRST_MARKER_RADIUS = 0.038;
const MARKER_COLOR = "#7dd3fc";
const FIRST_MARKER_COLOR = "#fbbf24";

export type DraftVertexMarkersHandle = {
  setPositions(points: readonly DisplayVec3[]): void;
  updatePosition(index: number, point: DisplayVec3): void;
  clear(): void;
};

/**
 * Draft polyline vertices as spheres (display space). All markers are pickable
 * (Slice C drag). Index 0 stays amber (close affordance). Hidden until placed
 * (POLYCUT-B-006 origin flash). Closed strokes omit the duplicate last marker
 * (POLYCUT-C-003); draft refs still keep the full point list for pairing.
 */
export const DraftVertexMarkers = forwardRef<
  DraftVertexMarkersHandle,
  {
    modelScale: number;
    onMarkerPointerDown: (index: number, event: ThreeEvent<PointerEvent>) => void;
  }
>(function DraftVertexMarkers({ modelScale, onMarkerPointerDown }, ref) {
  const [count, setCount] = useState(0);
  const pointsRef = useRef<DisplayVec3[]>([]);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const onDownRef = useRef(onMarkerPointerDown);

  useEffect(() => {
    onDownRef.current = onMarkerPointerDown;
  }, [onMarkerPointerDown]);

  const applyMeshPose = (mesh: THREE.Mesh | null, index: number) => {
    const p = pointsRef.current[index];
    if (!mesh || !p) return;
    mesh.position.set(p.x, p.y, p.z);
    mesh.visible = true;
  };

  useLayoutEffect(() => {
    for (let i = 0; i < count; i++) {
      applyMeshPose(meshRefs.current[i], i);
    }
  }, [count]);

  useImperativeHandle(
    ref,
    () => ({
      setPositions(points: readonly DisplayVec3[]) {
        pointsRef.current = points.map((p) => ({ x: p.x, y: p.y, z: p.z }));
        const closed = isExactlyClosedPolyline(pointsRef.current);
        const nextCount = draftMarkerCount(points.length, closed);
        if (nextCount === count) {
          for (let i = 0; i < nextCount; i++) {
            applyMeshPose(meshRefs.current[i], i);
          }
          return;
        }
        setCount(nextCount);
      },
      updatePosition(index: number, point: DisplayVec3) {
        if (index < 0 || index >= pointsRef.current.length) return;
        pointsRef.current[index] = { x: point.x, y: point.y, z: point.z };
        // Closed last twin is not mounted; only update visible markers.
        if (index < count) {
          applyMeshPose(meshRefs.current[index], index);
        }
      },
      clear() {
        pointsRef.current = [];
        setCount(0);
      },
    }),
    [count],
  );

  return (
    <group scale={modelScale}>
      {Array.from({ length: count }, (_, index) => {
        const isFirst = index === 0;
        return (
          <mesh
            key={index}
            visible={false}
            ref={(mesh) => {
              meshRefs.current[index] = mesh;
              applyMeshPose(mesh, index);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onDownRef.current(index, e);
            }}
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
