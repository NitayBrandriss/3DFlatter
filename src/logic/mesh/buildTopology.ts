import { makeEdgeKey } from "./edgeKey";
import type {
  EdgeIncident,
  EdgeKey,
  EdgeSlot,
  EdgeToFacesMap,
  FaceIndex,
  MeshModel,
  Topology,
} from "./types";
import { NO_NEIGHBOR, neighborIndex } from "./types";

function isDegenerateFace(v0: number, v1: number, v2: number): boolean {
  return v0 === v1 || v1 === v2 || v2 === v0;
}

function registerEdge(
  edgeToFaces: EdgeToFacesMap,
  key: EdgeKey,
  faceId: FaceIndex,
  slot: EdgeSlot,
): void {
  let list = edgeToFaces.get(key);
  if (!list) {
    list = [];
    edgeToFaces.set(key, list);
  }
  list.push({ faceId, slot });
}

/**
 * Derive adjacency from a triangulated MeshModel (ADR 0001).
 * Uses a consolidated edge map and a flat Int32Array neighbor buffer.
 */
export function buildTopology(mesh: MeshModel): Topology {
  if (mesh.faceCount === 0) {
    throw new Error("buildTopology: mesh has no faces");
  }

  const edgeToFaces: EdgeToFacesMap = new Map();
  const neighbors = new Int32Array(3 * mesh.faceCount);
  neighbors.fill(NO_NEIGHBOR);

  let skippedDegenerateFaceCount = 0;
  const { faces } = mesh;

  for (let faceId = 0; faceId < mesh.faceCount; faceId++) {
    const base = 3 * faceId;
    const v0 = faces[base]!;
    const v1 = faces[base + 1]!;
    const v2 = faces[base + 2]!;

    if (isDegenerateFace(v0, v1, v2)) {
      skippedDegenerateFaceCount++;
      continue;
    }

    registerEdge(edgeToFaces, makeEdgeKey(v0, v1), faceId, 0);
    registerEdge(edgeToFaces, makeEdgeKey(v1, v2), faceId, 1);
    registerEdge(edgeToFaces, makeEdgeKey(v2, v0), faceId, 2);
  }

  if (skippedDegenerateFaceCount > 0) {
    console.warn(
      `buildTopology: skipped ${skippedDegenerateFaceCount} degenerate face(s)`,
    );
  }

  for (const incidents of edgeToFaces.values()) {
    if (incidents.length !== 2) continue;

    const { faceId: fA, slot: slotA } = incidents[0] as EdgeIncident;
    const { faceId: fB, slot: slotB } = incidents[1] as EdgeIncident;
    neighbors[neighborIndex(fA, slotA)] = fB;
    neighbors[neighborIndex(fB, slotB)] = fA;
  }

  return {
    edgeToFaces,
    neighborFaceAcrossEdge: neighbors,
    skippedDegenerateFaceCount,
  };
}
