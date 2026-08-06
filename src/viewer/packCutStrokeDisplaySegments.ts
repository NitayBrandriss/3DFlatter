import type { MeshModel } from "../logic/mesh/types";
import type { Vec3 } from "../logic/cuts/types";
import { tessellateSurfaceSegment } from "../logic/cuts/surfacePath";
import type { CutStroke } from "../logic/cuts/types";
import {
  canonicalToDisplay,
  type DisplayNormalization,
} from "./displayNormalization";

/**
 * Pack committed cut strokes into LineSegments xyz pairs (display space).
 * Tessellates each sparse segment along the mesh surface before display mapping.
 */
export function packCutStrokeDisplaySegments(
  mesh: MeshModel,
  cutStrokes: readonly CutStroke[],
  normalization: DisplayNormalization,
): Float32Array | null {
  const densePaths: Vec3[][] = [];
  let segmentCount = 0;

  for (const stroke of cutStrokes) {
    if (stroke.points.length < 2) continue;
    const dense = tessellateStrokeDense(mesh, stroke);
    if (dense.length < 2) continue;
    densePaths.push(dense);
    segmentCount += dense.length - 1;
  }

  if (segmentCount === 0) return null;

  const positions = new Float32Array(segmentCount * 6);
  let o = 0;
  for (const dense of densePaths) {
    for (let i = 0; i < dense.length - 1; i++) {
      const a = canonicalToDisplay(dense[i]!, normalization);
      const b = canonicalToDisplay(dense[i + 1]!, normalization);
      positions[o++] = a.x;
      positions[o++] = a.y;
      positions[o++] = a.z;
      positions[o++] = b.x;
      positions[o++] = b.y;
      positions[o++] = b.z;
    }
  }
  return positions;
}

function tessellateStrokeDense(mesh: MeshModel, stroke: CutStroke): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < stroke.points.length - 1; i++) {
    const segment = tessellateSurfaceSegment(
      mesh,
      stroke.points[i]!,
      stroke.points[i + 1]!,
    );
    for (let j = 0; j < segment.length; j++) {
      if (j === 0 && out.length > 0) continue;
      out.push(segment[j]!);
    }
  }
  return out;
}
