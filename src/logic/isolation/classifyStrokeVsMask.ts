import type { CutStroke } from "../cuts/types";
import type { MeshModel } from "../mesh/types";
import { traceStrokeFences } from "./fenceEdgesFromStrokes";
import type { FaceMask, StrokeMaskRelation } from "./types";

/**
 * Inside = every surface-path face is in the mask; outside = none are;
 * crossing = some in, some out (ADR 0101). Empty path → outside.
 */
export function classifyStrokeVsMask(
  mesh: MeshModel,
  stroke: CutStroke,
  mask: FaceMask,
): StrokeMaskRelation {
  if (mask.length !== mesh.faceCount) {
    throw new Error(
      `classifyStrokeVsMask: mask length ${mask.length} !== faceCount ${mesh.faceCount}`,
    );
  }

  const { faces } = traceStrokeFences(mesh, stroke);
  if (faces.size === 0) return "outside";

  let anyIn = false;
  let anyOut = false;
  for (const fi of faces) {
    if (fi < 0 || fi >= mask.length) {
      anyOut = true;
      continue;
    }
    if (mask[fi]) anyIn = true;
    else anyOut = true;
    if (anyIn && anyOut) return "crossing";
  }
  return anyIn ? "inside" : "outside";
}

export type StrokesVsMask = {
  inside: CutStroke[];
  outside: CutStroke[];
  crossing: CutStroke[];
};

/** Partition overlay strokes for isolated Flatten (inside only; skip rest). */
export function partitionStrokesVsMask(
  mesh: MeshModel,
  strokes: readonly CutStroke[],
  mask: FaceMask,
): StrokesVsMask {
  const inside: CutStroke[] = [];
  const outside: CutStroke[] = [];
  const crossing: CutStroke[] = [];
  for (const stroke of strokes) {
    const rel = classifyStrokeVsMask(mesh, stroke, mask);
    if (rel === "inside") inside.push(stroke);
    else if (rel === "outside") outside.push(stroke);
    else crossing.push(stroke);
  }
  return { inside, outside, crossing };
}
