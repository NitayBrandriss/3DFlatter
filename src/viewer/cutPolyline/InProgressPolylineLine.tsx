"use client";

import * as THREE from "three";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";

export type DisplayVec3 = { x: number; y: number; z: number };

export type InProgressPolylineHandle = {
  setPlaced(points: readonly DisplayVec3[], recomputeBounds?: boolean): void;
  setPreviewTip(tip: DisplayVec3 | null): void;
  clear(): void;
};

/**
 * Imperative in-progress cut polyline (display space): placed vertices plus
 * optional rubber-band tip. Mutates BufferGeometry without React re-renders.
 */
export const InProgressPolylineLine = forwardRef<
  InProgressPolylineHandle,
  { modelScale: number }
>(function InProgressPolylineLine({ modelScale }, ref) {
  const placedRef = useRef<DisplayVec3[]>([]);
  const tipRef = useRef<DisplayVec3 | null>(null);

  const { line, geometry } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(0), 3),
    );
    const material = new THREE.LineBasicMaterial({
      color: "#7dd3fc",
      linewidth: 2,
      depthTest: true,
    });
    const lineObj = new THREE.Line(geo, material);
    lineObj.raycast = () => undefined;
    return { line: lineObj, geometry: geo };
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      (line.material as THREE.Material).dispose();
    };
  }, [geometry, line]);

  useEffect(() => {
    line.scale.setScalar(modelScale);
  }, [line, modelScale]);

  useImperativeHandle(
    ref,
    () => {
      const writeBuffer = (
        points: readonly DisplayVec3[],
        recomputeBounds: boolean,
      ) => {
        if (points.length < 2) {
          geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(new Float32Array(0), 3),
          );
          geometry.setDrawRange(0, 0);
          return;
        }
        const buf = new Float32Array(points.length * 3);
        for (let i = 0; i < points.length; i++) {
          const p = points[i]!;
          buf[i * 3] = p.x;
          buf[i * 3 + 1] = p.y;
          buf[i * 3 + 2] = p.z;
        }
        geometry.setAttribute("position", new THREE.BufferAttribute(buf, 3));
        geometry.setDrawRange(0, points.length);
        if (recomputeBounds) {
          geometry.computeBoundingSphere();
        }
      };

      const rebuild = (recomputeBounds: boolean) => {
        const placed = placedRef.current;
        const tip = tipRef.current;
        if (tip && placed.length >= 1) {
          writeBuffer([...placed, tip], recomputeBounds);
        } else {
          writeBuffer(placed, recomputeBounds);
        }
      };

      return {
        setPlaced(points: readonly DisplayVec3[], recomputeBounds = true) {
          placedRef.current = points.map((p) => ({ x: p.x, y: p.y, z: p.z }));
          rebuild(recomputeBounds);
        },
        setPreviewTip(tip: DisplayVec3 | null) {
          tipRef.current = tip ? { x: tip.x, y: tip.y, z: tip.z } : null;
          rebuild(false);
        },
        clear() {
          placedRef.current = [];
          tipRef.current = null;
          writeBuffer([], true);
        },
      };
    },
    [geometry],
  );

  return <primitive object={line} />;
});
