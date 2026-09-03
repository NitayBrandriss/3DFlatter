import type { EdgeKey, FaceIndex, SeamRegistry } from "../mesh/types";

/**
 * Packed isolation overlay keyed by original FaceIndex (ADR 0101).
 * Length === mesh.faceCount; 1 = included, 0 = remainder.
 */
export type FaceMask = Uint8Array;

/** How a seed flood combines with an existing mask. */
export type FloodCombineMode = "replace" | "add" | "subtract";

/**
 * Barriers for `floodFromFace` (virtual seams + opaque faces).
 * Fence fields come from `fenceEdgesFromStrokes`.
 */
export type FloodBarriers = {
  seams?: SeamRegistry;
  fenceEdges?: ReadonlySet<EdgeKey>;
  blockerFaces?: ReadonlySet<FaceIndex>;
};

export type FloodFromFaceResult = {
  faces: FaceIndex[];
  /**
   * True when the component is every non-orphan face.
   * UI must warn and not auto-isolate (ADR 0101).
   */
  coversAllNonOrphanFaces: boolean;
};

export type FenceFromStrokesResult = {
  fenceEdges: Set<EdgeKey>;
  /**
   * Faces the flood must not enter. Includes faces a stroke traversed
   * (a cut-through face is adjacent to both sides of the cut) and the
   * ADR 0101 fallback when a walk produces no exit edges.
   */
  blockerFaces: Set<FaceIndex>;
  warnings: string[];
};

/** Stroke vs isolate mask (Flatten skips crossing + outside). */
export type StrokeMaskRelation = "inside" | "outside" | "crossing";
