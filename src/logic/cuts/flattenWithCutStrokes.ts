import { partitionStrokesVsMask } from "../isolation/classifyStrokeVsMask";
import {
  assertSubsetHasFaces,
  extractFaceSubset,
} from "../isolation/extractFaceSubset";
import type { FaceMask } from "../isolation/types";
import { buildTopology } from "../mesh/buildTopology";
import type {
  EdgeKey,
  MeshModel,
  SeamRegistry,
  Topology,
  UnfoldMeshResult,
} from "../mesh/types";
import { unfoldMesh } from "../unfold/unfoldMesh";
import { materializeCutStrokes } from "./materializeCutStrokes";
import type { CutStroke, OpenLoopInfo } from "./types";

/** Crossing and outside strokes skipped by an active isolate (ADR 0101). */
export type SkippedCutStroke = {
  id: string;
  relation: "crossing" | "outside";
};

export type FlattenIsolation = {
  active: boolean;
  mask: FaceMask;
};

export type FlattenWithCutStrokesInput = {
  mesh: MeshModel;
  topology: Topology;
  seams: SeamRegistry;
  cutStrokes: readonly CutStroke[];
  /**
   * Omitted or `active === false` flattens the session mesh.
   * A stored mask is ignored until `active` is true (ADR 0101).
   */
  isolation?: FlattenIsolation;
};

export type FlattenWithCutStrokesResult = {
  unfold: UnfoldMeshResult;
  /** User-facing strings from materialize (skipped strokes, open loops, etc.). */
  materializeWarnings: string[];
  openLoops: OpenLoopInfo[];
  /** Seam keys passed into unfold / materialize. Not remapped. */
  appliedSeams: ReadonlySet<EdgeKey>;
  /** Stroke ids passed into materialize, in input order. */
  materializedStrokeIds: string[];
  /** Skipped strokes in input order. Empty when isolation is inactive. */
  skippedStrokes: SkippedCutStroke[];
  /**
   * Mesh unfolded before materialize: the face subset when isolation is
   * active, otherwise the session mesh. Not written back to the session.
   */
  flattenMesh: MeshModel;
};

/**
 * Keep a seam when the session topology has at least one incident face
 * inside the mask. One remaining face is enough (boundary or non-manifold).
 * EdgeKeys stay session vertex pairs — do not index the mask with packed
 * subset face ids.
 */
function seamsWithMaskedIncident(
  topology: Topology,
  seams: SeamRegistry,
  mask: FaceMask,
): SeamRegistry {
  const kept = new Set<EdgeKey>();
  for (const key of seams.seams) {
    const incidents = topology.edgeToFaces.get(key);
    if (!incidents) continue;
    for (const incident of incidents) {
      if (mask[incident.faceId] === 1) {
        kept.add(key);
        break;
      }
    }
  }
  return { seams: kept };
}

function unfoldPrepared(
  mesh: MeshModel,
  topology: Topology,
  seams: SeamRegistry,
  cutStrokes: readonly CutStroke[],
): Pick<
  FlattenWithCutStrokesResult,
  "unfold" | "materializeWarnings" | "openLoops"
> {
  if (cutStrokes.length === 0) {
    return {
      unfold: unfoldMesh(mesh, topology, seams),
      materializeWarnings: [],
      openLoops: [],
    };
  }

  const materialized = materializeCutStrokes(mesh, cutStrokes, seams);
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

/**
 * Flatten pipeline with optional freeform cuts (ADR 0100) and an optional
 * isolate subset (ADR 0101). Empty strokes → unfold the prepared mesh;
 * otherwise materialize then unfold the derived mesh.
 * Does not mutate the session mesh, seam registry, or stroke polylines.
 */
export function flattenWithCutStrokes(
  input: FlattenWithCutStrokesInput,
): FlattenWithCutStrokesResult {
  const isolation = input.isolation;
  if (!isolation?.active) {
    return {
      ...unfoldPrepared(
        input.mesh,
        input.topology,
        input.seams,
        input.cutStrokes,
      ),
      appliedSeams: input.seams.seams,
      materializedStrokeIds: input.cutStrokes.map((stroke) => stroke.id),
      skippedStrokes: [],
      flattenMesh: input.mesh,
    };
  }

  const subset = extractFaceSubset(input.mesh, isolation.mask);
  assertSubsetHasFaces(subset);
  const subsetTopology = buildTopology(subset);
  // Session mesh and original FaceIndex — subset face ids are packed.
  const parts = partitionStrokesVsMask(
    input.mesh,
    input.cutStrokes,
    isolation.mask,
  );
  const relationOf = new Map<CutStroke, "inside" | "outside" | "crossing">();
  for (const stroke of parts.inside) relationOf.set(stroke, "inside");
  for (const stroke of parts.outside) relationOf.set(stroke, "outside");
  for (const stroke of parts.crossing) relationOf.set(stroke, "crossing");

  const inside: CutStroke[] = [];
  const skippedStrokes: SkippedCutStroke[] = [];
  for (const stroke of input.cutStrokes) {
    const relation = relationOf.get(stroke);
    if (relation === "inside") {
      inside.push(stroke);
    } else if (relation === "outside" || relation === "crossing") {
      skippedStrokes.push({ id: stroke.id, relation });
    }
  }

  const applied = seamsWithMaskedIncident(
    input.topology,
    input.seams,
    isolation.mask,
  );
  return {
    ...unfoldPrepared(subset, subsetTopology, applied, inside),
    appliedSeams: applied.seams,
    materializedStrokeIds: inside.map((stroke) => stroke.id),
    skippedStrokes,
    flattenMesh: subset,
  };
}
