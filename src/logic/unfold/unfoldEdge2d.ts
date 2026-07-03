import type { Segment2d } from "../geom2d/segment2d";
import type { EdgeSlot, FaceIndex, MeshModel, Topology, UnfoldIslandResult } from "../mesh/types";
import { getNeighborAcrossEdge } from "../mesh/types";

const EDGE_SLOTS: EdgeSlot[] = [0, 1, 2];

export function segment2dForFaceSlot(
  mesh: MeshModel,
  result: UnfoldIslandResult,
  faceId: FaceIndex,
  slot: EdgeSlot,
): Segment2d | null {
  const soupIndex = result.faces.indexOf(faceId);
  if (soupIndex < 0) return null;

  const off = 6 * soupIndex;
  const base = 3 * faceId;
  const verts = [mesh.faces[base]!, mesh.faces[base + 1]!, mesh.faces[base + 2]!];
  const [va, vb] =
    slot === 0 ? [verts[0]!, verts[1]!] : slot === 1 ? [verts[1]!, verts[2]!] : [verts[2]!, verts[0]!];

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
