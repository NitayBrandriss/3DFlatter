import {
  buildSoupItems,
  buildUniformGrid,
  forEachCandidatePair,
} from "../geom2d/spatialGrid";
import {
  clipOverlappingTriangles,
  isEdgeOnlyContact,
  polygonArea,
  polygonCentroid,
  satOverlap,
  triangleAvgEdgeLength,
} from "../geom2d/triangle2d";
import { collisionAreaThreshold } from "../geom2d/tolerances";
import type { MeshModel, Topology, TriangleCollision2d, UnfoldIslandResult } from "../mesh/types";
import {
  buildFaceSoupIndexMap,
  segment2dForFaceSlot,
  sharedEdgeSlots,
} from "./unfoldEdge2d";
import { soupToTriangles } from "./soupToTriangles";

/** 3a — intra-island triangle interior collisions in local island XY. */
export function detectCollisions(
  mesh: MeshModel,
  topology: Topology,
  result: UnfoldIslandResult,
): TriangleCollision2d[] {
  const soupTris = soupToTriangles(result);
  if (soupTris.length < 2) return [];

  const triangles = soupTris.map((s) => s.tri);
  const faceIds = soupTris.map((s) => s.faceId);
  const items = buildSoupItems(triangles);
  if (items.length < 2) return [];

  const faceSoupIndex = buildFaceSoupIndexMap(result);
  const grid = buildUniformGrid(items);
  const collisions: TriangleCollision2d[] = [];

  forEachCandidatePair(grid, items, (lo, hi) => {
    const faceA = faceIds[lo]!;
    const faceB = faceIds[hi]!;
    const triA = triangles[lo]!;
    const triB = triangles[hi]!;

    if (!satOverlap(triA, triB)) return;

    // One clip after SAT — derive area + centroid from the same polygon (LOGIC-011).
    const overlapPoly = clipOverlappingTriangles(triA, triB);
    const overlapArea = polygonArea(overlapPoly);
    const avgLen = (triangleAvgEdgeLength(triA) + triangleAvgEdgeLength(triB)) / 2;
    const threshold = collisionAreaThreshold(avgLen);

    const slots = sharedEdgeSlots(topology, faceA, faceB);
    if (slots) {
      const sharedSegment = segment2dForFaceSlot(
        mesh,
        result,
        faceA,
        slots.slotA,
        faceSoupIndex,
      );
      if (
        sharedSegment &&
        isEdgeOnlyContact(overlapPoly, sharedSegment, overlapArea, threshold)
      ) {
        return;
      }
    }

    if (overlapArea <= threshold) return;

    collisions.push({
      islandIndex: 0,
      faceA,
      faceB,
      overlapArea,
      centroid: polygonCentroid(overlapPoly),
    });
  });

  return collisions;
}
