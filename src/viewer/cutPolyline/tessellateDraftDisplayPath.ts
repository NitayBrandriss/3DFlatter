import type { MeshModel } from "../../logic/mesh/types";
import type { Vec3 } from "../../logic/cuts/types";
import { tessellateSurfaceSegment } from "../../logic/cuts/surfacePath";
import {
  canonicalToDisplay,
  type DisplayNormalization,
} from "../displayNormalization";
import type { DisplayVec3 } from "./InProgressPolylineLine";

/**
 * Tessellate draft polyline + optional rubber-band tip into display-space line
 * points. The live draft hook tessellates placed vertices only (tipCanonical
 * null): hover/drag preview is a display-space chord so dense meshes stay
 * interactive. `incidentSparseSegmentStarts` documents which sparse segments
 * moved when a node is dragged. Tests may still pass a tip to characterize
 * a tessellated rubber-band.
 */
export function tessellateDraftDisplayPath(
  mesh: MeshModel,
  canonicalPlaced: readonly Vec3[],
  tipCanonical: Vec3 | null,
  normalization: DisplayNormalization,
): DisplayVec3[] {
  const canonicalPath: Vec3[] = [];

  for (let i = 0; i < canonicalPlaced.length - 1; i++) {
    appendSegment(mesh, canonicalPath, canonicalPlaced[i]!, canonicalPlaced[i + 1]!);
  }

  if (tipCanonical && canonicalPlaced.length >= 1) {
    appendSegment(
      mesh,
      canonicalPath,
      canonicalPlaced[canonicalPlaced.length - 1]!,
      tipCanonical,
    );
  }

  if (canonicalPath.length === 0) {
    return canonicalPlaced.map((p) => toDisplayVec3(p, normalization));
  }

  return canonicalPath.map((p) => toDisplayVec3(p, normalization));
}

function appendSegment(
  mesh: MeshModel,
  out: Vec3[],
  p0: Vec3,
  p1: Vec3,
): void {
  const segment = tessellateSurfaceSegment(mesh, p0, p1);
  for (let j = 0; j < segment.length; j++) {
    if (j === 0 && out.length > 0) continue;
    out.push(segment[j]!);
  }
}

function toDisplayVec3(
  canonical: Vec3,
  normalization: DisplayNormalization,
): DisplayVec3 {
  const d = canonicalToDisplay(canonical, normalization);
  return { x: d.x, y: d.y, z: d.z };
}
