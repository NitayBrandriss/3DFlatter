import {
  areCollinear,
  collinearIntervalOverlap,
  segmentLength,
  segmentParallelAngle,
  type Segment2d,
} from "../geom2d/segment2d";
import { ANGLE_EPS, SAT_EPS, tearThreshold } from "../geom2d/tolerances";
import type {
  EdgeKey,
  EdgeTear2d,
  FaceIndex,
  MeshModel,
  Topology,
  UnfoldIslandResult,
} from "../mesh/types";
import { distance3d } from "./placeTriangle2d";
import { segment2dForFaceSlot } from "./unfoldEdge2d";

function segmentEndpointMaxGap(a: Segment2d, b: Segment2d): number {
  const dist = (x0: number, y0: number, x1: number, y1: number) =>
    Math.hypot(x1 - x0, y1 - y0);
  const direct = Math.max(
    dist(a.x0, a.y0, b.x0, b.y0),
    dist(a.x1, a.y1, b.x1, b.y1),
  );
  const swapped = Math.max(
    dist(a.x0, a.y0, b.x1, b.y1),
    dist(a.x1, a.y1, b.x0, b.y0),
  );
  return Math.max(direct, swapped);
}

function classifyTearKind(segmentA: Segment2d, segmentB: Segment2d): EdgeTear2d["kind"] {
  if (areCollinear(segmentA, segmentB)) {
    const overlap = collinearIntervalOverlap(segmentA, segmentB);
    return overlap > SAT_EPS ? "overlap" : "gap";
  }
  if (segmentParallelAngle(segmentA, segmentB) <= ANGLE_EPS) {
    return "skew";
  }
  return "skew";
}

/** 3b — non-tree shared-edge disagreement in local island XY. */
export function detectTears(
  mesh: MeshModel,
  topology: Topology,
  islandFaces: FaceIndex[],
  result: UnfoldIslandResult,
  treeEdges: Set<EdgeKey>,
): EdgeTear2d[] {
  const islandSet = new Set(islandFaces);
  const tears: EdgeTear2d[] = [];

  for (const [edgeKey, incidents] of topology.edgeToFaces) {
    if (incidents.length !== 2) continue;

    const faceA = incidents[0]!.faceId;
    const faceB = incidents[1]!.faceId;
    if (!islandSet.has(faceA) || !islandSet.has(faceB)) continue;
    if (treeEdges.has(edgeKey)) continue;

    const slotA = incidents[0]!.slot;
    const slotB = incidents[1]!.slot;
    const segmentA = segment2dForFaceSlot(mesh, result, faceA, slotA);
    const segmentB = segment2dForFaceSlot(mesh, result, faceB, slotB);
    if (!segmentA || !segmentB) continue;

    if (segmentLength(segmentA) < SAT_EPS || segmentLength(segmentB) < SAT_EPS) continue;

    const base = edgeKey.split(",").map(Number);
    const va = base[0]!;
    const vb = base[1]!;
    const edgeLen3d = distance3d(mesh, va, vb);
    const thresh = tearThreshold(edgeLen3d);
    const maxGap = segmentEndpointMaxGap(segmentA, segmentB);
    if (maxGap <= thresh) continue;

    tears.push({
      islandIndex: 0,
      edgeKey,
      faceA,
      faceB,
      kind: classifyTearKind(segmentA, segmentB),
      maxGap,
      segmentA,
      segmentB,
    });
  }

  return tears;
}
