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
 *
 * `coversAllNonOrphanFaces` is true when the flooded faces plus scar blockers
 * (fallback blockers not entered) cover every non-orphan face.
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
    warnings: [],
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
  const warnings: string[] = [];
  const reportedNonManifold = new Set<string>();

  const seedIsBlocker = blockerFaces?.has(seedFace) === true;
  if (seedIsBlocker) {
    return {
      faces: [seedFace],
      coversAllNonOrphanFaces: nonOrphanCount === 1,
      warnings,
    };
  }

  const visited = new Uint8Array(mesh.faceCount);
  const faces: FaceIndex[] = [];
  const queue: FaceIndex[] = [seedFace];
  let head = 0;
  visited[seedFace] = 1;

  while (head < queue.length) {
    const faceId = queue[head++]!;
    faces.push(faceId);

    for (const slot of EDGE_SLOTS) {
      const key = edgeKeyForFace(mesh, faceId, slot);
      const incidents = topology.edgeToFaces.get(key);
      if (incidents && incidents.length > 2 && !reportedNonManifold.has(key)) {
        reportedNonManifold.add(key);
        warnings.push(
          `Non-manifold edge ${key} (${incidents.length} incidents) treated as flood boundary.`,
        );
      }

      const neighbor = getNeighborAcrossEdge(topology, faceId, slot);
      if (neighbor === null) continue;
      if (neighbor < 0 || neighbor >= mesh.faceCount) continue;
      if (visited[neighbor]) continue;
      if (blockerFaces?.has(neighbor)) continue;

      if (seamSet?.has(key)) continue;
      if (fenceEdges?.has(key)) continue;

      visited[neighbor] = 1;
      queue.push(neighbor);
    }
  }

  let scarBlockers = 0;
  if (blockerFaces) {
    for (const fi of blockerFaces) {
      if (fi < 0 || fi >= mesh.faceCount) continue;
      if (visited[fi]) continue;
      if (isTopologyOrphanFace(mesh, topology, fi)) continue;
      scarBlockers++;
    }
  }

  return {
    faces,
    coversAllNonOrphanFaces: faces.length + scarBlockers === nonOrphanCount,
    warnings,
  };
}
