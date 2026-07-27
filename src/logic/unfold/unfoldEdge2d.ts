import type { Segment2d } from "../geom2d/segment2d";
import { EDGE_SLOTS, directedEdgeForSlot, faceVertices } from "../mesh/faceUtils";
import type {
  EdgeSlot,
  FaceIndex,
  MeshModel,
  Topology,
  UnfoldIslandResult,
} from "../mesh/types";
import { getNeighborAcrossEdge } from "../mesh/types";

/** Face id → index in `result.faces` / soup slice (build once per island analysis). */
export function buildFaceSoupIndexMap(result: UnfoldIslandResult): Map<FaceIndex, number> {
  const map = new Map<FaceIndex, number>();
  for (let i = 0; i < result.faces.length; i++) {
    map.set(result.faces[i]!, i);
  }
  return map;
}

export function segment2dForFaceSlot(
  mesh: MeshModel,
  result: UnfoldIslandResult,
  faceId: FaceIndex,
  slot: EdgeSlot,
  faceSoupIndex?: ReadonlyMap<FaceIndex, number>,
): Segment2d | null {
  const soupIndex = faceSoupIndex
    ? faceSoupIndex.get(faceId)
    : result.faces.indexOf(faceId);
  if (soupIndex === undefined || soupIndex < 0) return null;

  const off = 6 * soupIndex;
  const base = 3 * faceId;
  const verts = faceVertices(mesh, faceId);
  const [va, vb] = directedEdgeForSlot(verts, slot);

  const corner = (vi: number): { x: number; y: number } | null => {
    for (let i = 0; i < 3; i++) {
      if (mesh.faces[base + i] === vi) {
        return {
          x: result.positions2d[off + 2 * i]!,
          y: result.positions2d[off + 2 * i + 1]!,
        };
      }
    }
    return null;
  };

  const pa = corner(va);
  const pb = corner(vb);
  if (!pa || !pb) return null;
  return { x0: pa.x, y0: pa.y, x1: pb.x, y1: pb.y };
}

export function sharedEdgeSlots(
  topology: Topology,
  faceA: FaceIndex,
  faceB: FaceIndex,
): { slotA: EdgeSlot; slotB: EdgeSlot } | null {
  for (const slotA of EDGE_SLOTS) {
    if (getNeighborAcrossEdge(topology, faceA, slotA) !== faceB) continue;
    for (const slotB of EDGE_SLOTS) {
      if (getNeighborAcrossEdge(topology, faceB, slotB) === faceA) {
        return { slotA, slotB };
      }
    }
  }
  return null;
}
