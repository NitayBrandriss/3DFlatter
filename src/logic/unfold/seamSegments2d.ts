import { parseEdgeKey } from "../mesh/edgeKey";
import type {
  EdgeKey,
  FaceIndex,
  LayoutedIsland,
  MeshModel,
  SeamRegistry,
  SeamSegment2d,
  Topology,
} from "../mesh/types";
import { canSelectAsSeam } from "../seams/edgeEligibility";
import { corner2dForVertexOnFaceSlice } from "./soupBounds";

export type SeamSegmentSkip = {
  edgeKey: EdgeKey;
  reason: string;
};

export type ListSeamSegments2dResult = {
  segments: SeamSegment2d[];
  skipped: SeamSegmentSkip[];
};

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
 * Only manifold-eligible seams are exported (LOGIC-015); skips are reported (LOGIC-014).
 * Each eligible seam yields up to two segments (one per incident face side).
 */
export function listSeamSegments2d(
  mesh: MeshModel,
  topology: Topology,
  seams: SeamRegistry,
  islands: LayoutedIsland[],
): ListSeamSegments2dResult {
  const faceMap = buildFacePlacementMap(islands);
  const segments: SeamSegment2d[] = [];
  const skipped: SeamSegmentSkip[] = [];

  for (const key of seams.seams) {
    const eligibility = canSelectAsSeam(topology, key);
    if (!eligibility.ok) {
      skipped.push({ edgeKey: key, reason: eligibility.reason });
      continue;
    }

    const [va, vb] = parseEdgeKey(key);
    const incidents = topology.edgeToFaces.get(key);
    if (!incidents || incidents.length !== 2) {
      skipped.push({ edgeKey: key, reason: "Edge not found in mesh topology." });
      continue;
    }

    let addedForEdge = 0;
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
      addedForEdge++;
    }

    if (addedForEdge === 0) {
      skipped.push({
        edgeKey: key,
        reason: "No 2D geometry for seam (incident faces may have failed to unfold).",
      });
    }
  }

  return { segments, skipped };
}
