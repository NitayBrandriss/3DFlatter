"use client";

import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { CutStroke } from "../logic/cuts/types";
import type { MeshModel } from "../logic/mesh/types";
import type { DisplayNormalization } from "./displayNormalization";
import { canonicalToDisplay } from "./displayNormalization";
import { fatLineRaycast } from "./cutPolyline/fatLineRaycast";
import { tessellateStrokeCanonicalPath } from "./packCutStrokeDisplaySegments";

const DRAG_THRESHOLD_PX = 5;

/**
 * Invisible per-stroke pick proxies for committed cuts (Slice D).
 * Visual overlay stays a packed LineSegments with raycast disabled.
 */
export function CommittedStrokePickables({
  mesh,
  cutStrokes,
  normalization,
  modelScale,
  enabled,
  onPickStroke,
}: {
  mesh: MeshModel;
  cutStrokes: readonly CutStroke[];
  normalization: DisplayNormalization;
  modelScale: number;
  enabled: boolean;
  onPickStroke: (stroke: CutStroke) => void;
}) {
  if (!enabled) return null;
  return (
    <>
      {cutStrokes.map((stroke) =>
        stroke.points.length >= 2 ? (
          <StrokePickLine
            key={stroke.id}
            mesh={mesh}
            stroke={stroke}
            normalization={normalization}
            modelScale={modelScale}
            onPickStroke={onPickStroke}
          />
        ) : null,
      )}
    </>
  );
}

function StrokePickLine({
  mesh,
  stroke,
  normalization,
  modelScale,
  onPickStroke,
}: {
  mesh: MeshModel;
  stroke: CutStroke;
  normalization: DisplayNormalization;
  modelScale: number;
  onPickStroke: (stroke: CutStroke) => void;
}) {
  const pointerDown = useRef<{ x: number; y: number } | null>(null);

  const line = useMemo(() => {
    const dense = tessellateStrokeCanonicalPath(mesh, stroke);
    if (dense.length < 2) return null;
    const buf = new Float32Array(dense.length * 3);
    for (let i = 0; i < dense.length; i++) {
      const d = canonicalToDisplay(dense[i]!, normalization);
      buf[i * 3] = d.x;
      buf[i * 3 + 1] = d.y;
      buf[i * 3 + 2] = d.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(buf, 3));
    const material = new THREE.LineBasicMaterial({
      color: "#38bdf8",
      transparent: true,
      opacity: 0,
      depthTest: false,
    });
    const lineObj = new THREE.Line(geo, material);
    lineObj.raycast = fatLineRaycast;
    return lineObj;
  }, [mesh, stroke, normalization]);

  useEffect(() => {
    return () => {
      if (!line) return;
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    };
  }, [line]);

  useEffect(() => {
    if (line) line.scale.setScalar(modelScale);
  }, [line, modelScale]);

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    pointerDown.current = {
      x: e.nativeEvent.clientX,
      y: e.nativeEvent.clientY,
    };
  };

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!pointerDown.current) return;
    const dx = e.nativeEvent.clientX - pointerDown.current.x;
    const dy = e.nativeEvent.clientY - pointerDown.current.y;
    pointerDown.current = null;
    if (dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
    onPickStroke(stroke);
  };

  if (!line) return null;

  return (
    <primitive
      object={line}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        pointerDown.current = null;
      }}
    />
  );
}
