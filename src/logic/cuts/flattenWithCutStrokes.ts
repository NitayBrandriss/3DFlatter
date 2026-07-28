import type { MeshModel, SeamRegistry, Topology, UnfoldMeshResult } from "../mesh/types";
import { unfoldMesh } from "../unfold/unfoldMesh";
import { materializeCutStrokes } from "./materializeCutStrokes";
import type { CutStroke, OpenLoopInfo } from "./types";

export type FlattenWithCutStrokesInput = {
  mesh: MeshModel;
  topology: Topology;
  seams: SeamRegistry;
  cutStrokes: readonly CutStroke[];
};

export type FlattenWithCutStrokesResult = {
  unfold: UnfoldMeshResult;
  /** User-facing strings from materialize (skipped strokes, open loops, etc.). */
  materializeWarnings: string[];
  openLoops: OpenLoopInfo[];
};

/**
 * Flatten pipeline with optional freeform cuts (ADR 0100).
 * Empty strokes → unfold base mesh; otherwise materialize then unfold derived.
 */
export function flattenWithCutStrokes(
  input: FlattenWithCutStrokesInput,
): FlattenWithCutStrokesResult {
  if (input.cutStrokes.length === 0) {
    return {
      unfold: unfoldMesh(input.mesh, input.topology, input.seams),
      materializeWarnings: [],
      openLoops: [],
    };
  }

  const materialized = materializeCutStrokes(
    input.mesh,
    input.cutStrokes,
    input.seams,
  );
  return {
    unfold: unfoldMesh(
      materialized.mesh,
      materialized.topology,
      materialized.seams,
    ),
    materializeWarnings: materialized.warnings,
    openLoops: materialized.validation.openLoops,
  };
}
