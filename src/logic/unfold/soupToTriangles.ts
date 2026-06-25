import type { FaceIndex, UnfoldIslandResult } from "../mesh/types";
import type { Triangle2d } from "../geom2d/triangle2d";

export type SoupTriangle = {
  faceId: FaceIndex;
  soupIndex: number;
  tri: Triangle2d;
};

/** Map unfolded island soup to face-aligned 2D triangles (preserves mesh winding). */
export function soupToTriangles(result: UnfoldIslandResult): SoupTriangle[] {
  const items: SoupTriangle[] = [];
  for (let i = 0; i < result.faces.length; i++) {
    const off = 6 * i;
    const tri: Triangle2d = [
      { x: result.positions2d[off]!, y: result.positions2d[off + 1]! },
      { x: result.positions2d[off + 2]!, y: result.positions2d[off + 3]! },
      { x: result.positions2d[off + 4]!, y: result.positions2d[off + 5]! },
    ];
    items.push({ faceId: result.faces[i]!, soupIndex: i, tri });
  }
  return items;
}
