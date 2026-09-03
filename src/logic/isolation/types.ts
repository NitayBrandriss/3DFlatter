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
   * True when the flooded component plus scar blockers cover every
   * non-orphan face (ADR 0101 whole-mesh warn — mesh-minus-ribbon counts).
   */
  coversAllNonOrphanFaces: boolean;
  /** Non-manifold edges treated as walls, and other flood diagnostics. */
  warnings: string[];
};

export type FenceFromStrokesResult = {
  fenceEdges: Set<EdgeKey>;
  /**
   * Opaque faces for flood — ADR 0101 **fallback only**: unioned when a
   * stroke walk produces no exit edges. Walked faces with exits are not
   * blockers (thin virtual seams).
   */
  blockerFaces: Set<FaceIndex>;
  /** Walked faces for classify / diagnostics (may exceed blockerFaces). */
  walkedFaces: Set<FaceIndex>;
  warnings: string[];
};

/** Stroke vs isolate mask (Flatten skips crossing + outside). */
export type StrokeMaskRelation = "inside" | "outside" | "crossing";
