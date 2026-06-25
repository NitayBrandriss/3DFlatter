import type { Bbox2d } from "../mesh/types";
import { GRID_MAX_CELL_DIVISOR, GRID_MIN_CELL } from "./tolerances";
import { aabbsSeparated, isDegenerateTriangle, triangleAabb, type Triangle2d } from "./triangle2d";

export type TriangleSoupItem = {
  soupIndex: number;
  tri: Triangle2d;
  aabb: Bbox2d;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function bboxMaxSide(b: Bbox2d): number {
  return Math.max(b.maxX - b.minX, b.maxY - b.minY);
}

function median(values: number[]): number {
  if (values.length === 0) return GRID_MIN_CELL;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/** Compute uniform grid cell size from triangle AABBs (ADR 0003). */
export function computeGridCellSize(items: TriangleSoupItem[], islandBounds: Bbox2d): number {
  const sides = items.map((item) => bboxMaxSide(item.aabb));
  const medianSide = median(sides);
  const islandMax = bboxMaxSide(islandBounds);
  const maxCell = islandMax > 0 ? islandMax / GRID_MAX_CELL_DIVISOR : GRID_MIN_CELL;
  return clamp(medianSide, GRID_MIN_CELL, Math.max(GRID_MIN_CELL, maxCell));
}

function cellKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

export type UniformGrid = {
  cellSize: number;
  bounds: Bbox2d;
  /** cell key → soup indices in that cell */
  cells: Map<string, number[]>;
};

export function createUniformGrid(bounds: Bbox2d, cellSize: number): UniformGrid {
  return { cellSize, bounds, cells: new Map() };
}

function cellRangeForAabb(
  aabb: Bbox2d,
  bounds: Bbox2d,
  cellSize: number,
): { minCx: number; maxCx: number; minCy: number; maxCy: number } {
  const minCx = Math.floor((aabb.minX - bounds.minX) / cellSize);
  const maxCx = Math.floor((aabb.maxX - bounds.minX) / cellSize);
  const minCy = Math.floor((aabb.minY - bounds.minY) / cellSize);
  const maxCy = Math.floor((aabb.maxY - bounds.minY) / cellSize);
  return { minCx, maxCx, minCy, maxCy };
}

export function insertIntoGrid(grid: UniformGrid, soupIndex: number, aabb: Bbox2d): void {
  const { minCx, maxCx, minCy, maxCy } = cellRangeForAabb(aabb, grid.bounds, grid.cellSize);
  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cy = minCy; cy <= maxCy; cy++) {
      const key = cellKey(cx, cy);
      const bucket = grid.cells.get(key);
      if (bucket) bucket.push(soupIndex);
      else grid.cells.set(key, [soupIndex]);
    }
  }
}

export function unionIslandBounds(items: TriangleSoupItem[]): Bbox2d {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of items) {
    minX = Math.min(minX, item.aabb.minX);
    minY = Math.min(minY, item.aabb.minY);
    maxX = Math.max(maxX, item.aabb.maxX);
    maxY = Math.max(maxY, item.aabb.maxY);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  return { minX, minY, maxX, maxY };
}

export function buildUniformGrid(items: TriangleSoupItem[]): UniformGrid {
  const bounds = unionIslandBounds(items);
  const cellSize = computeGridCellSize(items, bounds);
  const grid = createUniformGrid(bounds, cellSize);
  for (const item of items) {
    insertIntoGrid(grid, item.soupIndex, item.aabb);
  }
  return grid;
}

/**
 * Emit unique candidate pairs (i, j) with i < j from grid cells.
 * Optional `aabbReject` filters pairs whose AABBs are separated.
 */
export function forEachCandidatePair(
  grid: UniformGrid,
  items: TriangleSoupItem[],
  visit: (i: number, j: number) => void,
  aabbReject = true,
): void {
  const bySoupIndex = new Map(items.map((item) => [item.soupIndex, item]));
  const seen = new Set<string>();
  for (const indices of grid.cells.values()) {
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const i = indices[a]!;
        const j = indices[b]!;
        const lo = Math.min(i, j);
        const hi = Math.max(i, j);
        const key = `${lo},${hi}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (aabbReject) {
          const itemI = bySoupIndex.get(lo);
          const itemJ = bySoupIndex.get(hi);
          if (!itemI || !itemJ) continue;
          if (aabbsSeparated(itemI.aabb, itemJ.aabb)) continue;
        }
        visit(lo, hi);
      }
    }
  }
}

/** Build soup items from triangles, skipping degenerates (ADR 0003 W6). */
export function buildSoupItems(triangles: Triangle2d[]): TriangleSoupItem[] {
  const items: TriangleSoupItem[] = [];
  for (let i = 0; i < triangles.length; i++) {
    const tri = triangles[i]!;
    if (isDegenerateTriangle(tri)) continue;
    const aabb = triangleAabb(tri);
    items.push({ soupIndex: i, tri, aabb });
  }
  return items;
}
