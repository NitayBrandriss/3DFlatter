import { EDGE_SLOTS, edgeKeyForFace } from "../mesh/faceUtils";
import { isTopologyOrphanFace } from "../mesh/partitionIslands";
import type { FaceIndex, MeshModel, Topology } from "../mesh/types";
import { getNeighborAcrossEdge } from "../mesh/types";
import type { FloodBarriers, FloodFromFaceResult } from "./types";

function countNonOrphanFaces(mesh: MeshModel, topology: Topology): number {
  let n = 0;
  for (let i = 0; i < mesh.faceCount; i++) {
    if (!isTopologyOrphanFace(mesh, topology, i)) n++;
  }
  return n;
}

/**
 * BFS from a seed face, stopping at seams, fence edges, blocker faces, and
 * mesh boundary (ADR 0101). Seed is always included when it is a valid
 * non-orphan face; a blocker seed does not expand (single-face cleanup).
 */
export function floodFromFace(
  mesh: MeshModel,
  topology: Topology,
  seedFace: FaceIndex,
  barriers: FloodBarriers = {},
): FloodFromFaceResult {
  const empty: FloodFromFaceResult = {
    faces: [],
    coversAllNonOrphanFaces: false,
  };
  if (
    seedFace < 0 ||
    seedFace >= mesh.faceCount ||
    isTopologyOrphanFace(mesh, topology, seedFace)
  ) {
    return empty;
  }

  const seamSet = barriers.seams?.seams;
  const fenceEdges = barriers.fenceEdges;
  const blockerFaces = barriers.blockerFaces;
  const nonOrphanCount = countNonOrphanFaces(mesh, topology);

  const seedIsBlocker = blockerFaces?.has(seedFace) === true;
  if (seedIsBlocker) {
    return {
      faces: [seedFace],
      coversAllNonOrphanFaces: nonOrphanCount === 1,
    };
  }

  const visited = new Uint8Array(mesh.faceCount);
  const faces: FaceIndex[] = [];
  const queue: FaceIndex[] = [seedFace];
  visited[seedFace] = 1;

  while (queue.length > 0) {
    const faceId = queue.pop()!;
    faces.push(faceId);

    for (const slot of EDGE_SLOTS) {
      const neighbor = getNeighborAcrossEdge(topology, faceId, slot);
      if (neighbor === null || visited[neighbor]) continue;
      if (blockerFaces?.has(neighbor)) continue;

      const key = edgeKeyForFace(mesh, faceId, slot);
      if (seamSet?.has(key)) continue;
      if (fenceEdges?.has(key)) continue;

      visited[neighbor] = 1;
      queue.push(neighbor);
    }
  }

  return {
    faces,
    coversAllNonOrphanFaces: faces.length === nonOrphanCount,
  };
}
