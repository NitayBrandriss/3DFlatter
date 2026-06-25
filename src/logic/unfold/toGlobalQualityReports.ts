import type { Segment2d } from "../geom2d/segment2d";
import type { EdgeTear2d, LayoutedIsland, TriangleCollision2d } from "../mesh/types";
import type { IslandQualityReport } from "./analyzeUnfoldedIsland";

function offsetSegment(seg: Segment2d, dx: number, dy: number): Segment2d {
  return {
    x0: seg.x0 + dx,
    y0: seg.y0 + dy,
    x1: seg.x1 + dx,
    y1: seg.y1 + dy,
  };
}

/** Promote local island quality reports to layout-global XY. */
export function toGlobalQualityReports(
  localReports: IslandQualityReport[],
  islands: LayoutedIsland[],
): { collisions: TriangleCollision2d[]; tears: EdgeTear2d[] } {
  if (localReports.length !== islands.length) {
    throw new Error(
      `Quality report count (${localReports.length}) does not match layouted islands (${islands.length}).`,
    );
  }

  const collisions: TriangleCollision2d[] = [];
  const tears: EdgeTear2d[] = [];

  for (let i = 0; i < localReports.length; i++) {
    const report = localReports[i]!;
    const island = islands[i]!;
    const { x: dx, y: dy } = island.offset;
    const islandIndex = island.islandIndex;

    for (const c of report.collisions) {
      collisions.push({
        ...c,
        islandIndex,
        centroid: { x: c.centroid.x + dx, y: c.centroid.y + dy },
      });
    }

    for (const t of report.tears) {
      tears.push({
        ...t,
        islandIndex,
        segmentA: offsetSegment(t.segmentA, dx, dy),
        segmentB: offsetSegment(t.segmentB, dx, dy),
      });
    }
  }

  return { collisions, tears };
}
