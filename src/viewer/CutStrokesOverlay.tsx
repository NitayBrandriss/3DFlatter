"use client";

import * as THREE from "three";
import { useEffect, useMemo } from "react";
import type { CutStroke } from "../logic/cuts/types";
import type { DisplayNormalization } from "./displayNormalization";
import { packCutStrokeDisplaySegments } from "./packCutStrokeDisplaySegments";

/**
 * Committed freeform cut strokes (ADR 0100). Rebuilds geometry when the
 * stroke list identity changes — not on in-progress pointermove samples.
 */
export function CutStrokesOverlay({
  cutStrokes,
  normalization,
  modelScale,
}: {
  cutStrokes: readonly CutStroke[];
  normalization: DisplayNormalization;
  modelScale: number;
}) {
  const lineGeometry = useMemo(() => {
    const positions = packCutStrokeDisplaySegments(cutStrokes, normalization);
    if (!positions) return null;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, [cutStrokes, normalization]);

  useEffect(() => {
    return () => lineGeometry?.dispose();
  }, [lineGeometry]);

  if (!lineGeometry) return null;

  return (
    <lineSegments
      geometry={lineGeometry}
      scale={modelScale}
      raycast={() => undefined}
    >
      <lineBasicMaterial color="#38bdf8" linewidth={2} depthTest />
    </lineSegments>
  );
}
