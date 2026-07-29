import type { EdgeKey, MeshModel, SeamRegistry, Topology } from "../mesh/types";

/** Canonical 3D point (mesh space, not display-scaled). */
export type Vec3 = { x: number; y: number; z: number };

/**
 * One freeform cut stroke overlay (ADR 0100).
 * Optional fold metadata reserved for later phases.
 */
export type CutStroke = {
  id: string;
  points: readonly Vec3[];
  role?: "cut" | "fold";
  foldKind?: "mountain" | "valley";
};

/** Maps a stroke segment to derived seam edges after materialize. */
export type CutManifestEntry = {
  strokeId: string;
  segmentIndex: number;
  edgeKeys: EdgeKey[];
};

export type OpenLoopInfo = {
  strokeId: string;
  /** 0 = start, 1 = end — endpoints not on a boundary edge. */
  interiorEndpoints: (0 | 1)[];
};

export type MaterializeValidation = {
  openLoops: OpenLoopInfo[];
};

export type MaterializeCutStrokesResult = {
  mesh: MeshModel;
  topology: Topology;
  seams: SeamRegistry;
  warnings: string[];
  manifest: CutManifestEntry[];
  validation: MaterializeValidation;
};
