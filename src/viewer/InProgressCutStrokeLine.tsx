"use client";

import * as THREE from "three";
import { forwardRef, useEffect, useImperativeHandle, useMemo } from "react";

export type InProgressCutStrokeHandle = {
  setPoints: (points: readonly { x: number; y: number; z: number }[]) => void;
  clear: () => void;
};

/**
 * Imperative in-progress cut polyline (display space). Mutates BufferGeometry
 * without React re-renders so pointermove stays off the Zustand store.
 */
export const InProgressCutStrokeLine = forwardRef<
  InProgressCutStrokeHandle,
  { modelScale: number }
>(function InProgressCutStrokeLine({ modelScale }, ref) {
  const { line, geometry } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(0), 3));
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
      const setPoints = (
        points: readonly { x: number; y: number; z: number }[],
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
        geometry.computeBoundingSphere();
      };
      return {
        setPoints,
        clear() {
          setPoints([]);
        },
      };
    },
    [geometry],
  );

  return <primitive object={line} />;
});
