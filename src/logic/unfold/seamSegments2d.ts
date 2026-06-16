import type {
  EdgeKey,
  FaceIndex,
  LayoutedIsland,
  MeshModel,
  SeamRegistry,
  SeamSegment2d,
  Topology,
} from "../mesh/types";
import { corner2dForVertexOnFaceSlice } from "./soupBounds";

function parseEdgeKey(key: EdgeKey): [number, number] {
  const [a, b] = key.split(",").map((s) => Number.parseInt(s, 10));
  return [a!, b!];
}

function buildFacePlacementMap(
  islands: LayoutedIsland[],
): Map<FaceIndex, { soup: LayoutedIsland["positions2d"]; faceIdxInSoup: number }> {
  const map = new Map<
    FaceIndex,
    { soup: LayoutedIsland["positions2d"]; faceIdxInSoup: number }
  >();
  for (const island of islands) {
    for (let i = 0; i < island.faces.length; i++) {
      map.set(island.faces[i]!, { soup: island.positions2d, faceIdxInSoup: i });
    }
  }
  return map;
}

/**
 * Map seam edges to 2D line segments on layouted island boundaries.
 * Each manifold seam yields up to two segments (one per incident face side).
 */
export function listSeamSegments2d(
  mesh: MeshModel,
  topology: Topology,
  seams: SeamRegistry,
  islands: LayoutedIsland[],
): SeamSegment2d[] {
  const faceMap = buildFacePlacementMap(islands);
  const segments: SeamSegment2d[] = [];

  for (const key of seams.seams) {
    const [va, vb] = parseEdgeKey(key);
    const incidents = topology.edgeToFaces.get(key);
    if (!incidents) continue;

    for (const { faceId } of incidents) {
      const placement = faceMap.get(faceId);
      if (!placement) continue;

      const a = corner2dForVertexOnFaceSlice(
        mesh,
        faceId,
        placement.soup,
        placement.faceIdxInSoup,
        va,
      );
      const b = corner2dForVertexOnFaceSlice(
        mesh,
        faceId,
        placement.soup,
        placement.faceIdxInSoup,
        vb,
      );
      if (!a || !b) continue;

      segments.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y });
    }
  }

  return segments;
}
