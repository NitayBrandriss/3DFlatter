import type { Bbox2d, LayoutedIsland, UnfoldIslandResult } from "../mesh/types";
import {
  bboxArea,
  bboxHeight,
  bboxWidth,
  boundsFromSoup,
  mergeBounds,
  translateSoup,
} from "./soupBounds";

export const ISLAND_GAP = 0.5;

export type LayoutIslandsOptions = {
  islandGap?: number;
  /** Override row width (for tests). Default: sqrt(sum of island bbox areas). */
  maxRowWidth?: number;
};

/**
 * Pack unfolded islands into global XY (math Y-up) with wrapped rows.
 * Islands do not overlap; each soup is translated so its local bbox min corner
 * sits at the pack cursor.
 *
 * Row wrap: when a row is full, the next island starts below the packed envelope
 * (`packed.minY - gap - height`), not merely `cursorY -= previousRowHeight + gap`.
 * The latter allowed a taller next island to intrude into the row above when each
 * island wrapped alone (common with wide icosahedron strips).
 */
export function layoutIslands(
  unfolded: UnfoldIslandResult[],
  options: LayoutIslandsOptions = {},
): LayoutedIsland[] {
  if (unfolded.length === 0) return [];

  const gap = options.islandGap ?? ISLAND_GAP;
  const localBounds = unfolded.map((u) => boundsFromSoup(u.positions2d));

  const totalArea = localBounds.reduce((sum, b) => sum + bboxArea(b), 0);
  const widest = Math.max(...localBounds.map((b) => bboxWidth(b)), 0);
  const maxRowWidth = options.maxRowWidth ?? Math.max(widest, Math.sqrt(totalArea));

  const layouted: LayoutedIsland[] = [];
  let packed: Bbox2d | null = null;
  let cursorX = 0;
  let cursorY = 0;

  for (let i = 0; i < unfolded.length; i++) {
    const item = unfolded[i]!;
    const local = localBounds[i]!;
    const width = bboxWidth(local);
    const height = bboxHeight(local);

    if (cursorX > 0 && cursorX + width + gap > maxRowWidth) {
      cursorX = 0;
      if (packed) {
        cursorY = packed.minY - gap - height;
      }
    }

    const dx = cursorX - local.minX;
    const dy = cursorY - local.minY;
    const positions2d = translateSoup(item.positions2d, dx, dy);
    const bounds = boundsFromSoup(positions2d);

    layouted.push({
      islandIndex: i,
      faces: item.faces,
      positions2d,
      offset: { x: dx, y: dy },
      bounds,
    });

    packed = packed ? mergeBounds(packed, bounds) : bounds;
    cursorX += width + gap;
  }

  return layouted;
}

/** Combined bounds of all layouted islands. */
export function combinedBounds(islands: LayoutedIsland[]): Bbox2d {
  if (islands.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  return islands.slice(1).reduce((acc, isl) => mergeBounds(acc, isl.bounds), islands[0]!.bounds);
}
