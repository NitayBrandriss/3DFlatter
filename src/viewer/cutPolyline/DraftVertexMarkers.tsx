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
import { useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import {
  draftMarkerCount,
  isExactlyClosedPolyline,
} from "./cutPolylineHelpers";
import type { DisplayVec3 } from "./InProgressPolylineLine";
import { markerScaleForScreenPixels } from "./markerScreenScale";

const MARKER_RADIUS = 0.028;
const FIRST_MARKER_RADIUS = 0.038;
const MARKER_TARGET_PX = 9;
const FIRST_MARKER_TARGET_PX = 11;
const MARKER_COLOR = "#7dd3fc";
const FIRST_MARKER_COLOR = "#fbbf24";

const _worldPos = new THREE.Vector3();

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
  const lastScaleRef = useRef({ first: 1, rest: 1 });
  const { camera, size } = useThree();

  useEffect(() => {
    onDownRef.current = onMarkerPointerDown;
  }, [onMarkerPointerDown]);

  const applyMarkerScales = () => {
    const fov =
      camera instanceof THREE.PerspectiveCamera ? camera.fov : 50;
    const parentScale = modelScale === 0 ? 1 : Math.abs(modelScale);
    for (let i = 0; i < count; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;
      mesh.getWorldPosition(_worldPos);
      const distance = _worldPos.distanceTo(camera.position);
      const isFirst = i === 0;
      const scale = markerScaleForScreenPixels({
        distance,
        fovDeg: fov,
        viewportHeightPx: size.height,
        geometryRadius: isFirst ? FIRST_MARKER_RADIUS : MARKER_RADIUS,
        parentScale,
        targetRadiusPx: isFirst ? FIRST_MARKER_TARGET_PX : MARKER_TARGET_PX,
      });
      if (isFirst) lastScaleRef.current.first = scale;
      else lastScaleRef.current.rest = scale;
      mesh.scale.setScalar(scale);
    }
  };

  const applyMeshPose = (mesh: THREE.Mesh | null, index: number) => {
    const p = pointsRef.current[index];
    if (!mesh || !p) return;
    mesh.position.set(p.x, p.y, p.z);
    mesh.visible = true;
    mesh.scale.setScalar(
      index === 0 ? lastScaleRef.current.first : lastScaleRef.current.rest,
    );
  };

  useLayoutEffect(() => {
    for (let i = 0; i < count; i++) {
      applyMeshPose(meshRefs.current[i], i);
    }
    applyMarkerScales();
    // Pose + pixel scale from the latest camera/size; helpers are render-local.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [count, modelScale, camera, size.height]);

  useFrame(() => {
    applyMarkerScales();
  });

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
