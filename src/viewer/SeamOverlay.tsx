"use client";

import * as THREE from "three";
import { useEffect, useMemo } from "react";
import type { SeamRegistry } from "../logic/mesh/types";
import { listDisplaySeamSegments } from "../logic/seams/displaySeamSegments";

export function SeamOverlay({
  displayVertices,
  seams,
  modelScale,
}: {
  /** Same display-normalized buffer used by the rendered mesh geometry. */
  displayVertices: Float32Array;
  seams: SeamRegistry;
  modelScale: number;
}) {
  const lineGeometry = useMemo(() => {
    if (seams.seams.size === 0) return null;

    const positions = listDisplaySeamSegments(displayVertices, seams);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, [displayVertices, seams]);

  useEffect(() => {
    return () => lineGeometry?.dispose();
  }, [lineGeometry]);

  if (!lineGeometry) return null;

  return (
    <lineSegments geometry={lineGeometry} scale={modelScale}>
      <lineBasicMaterial color="#ff4444" linewidth={2} depthTest />
    </lineSegments>
  );
}
