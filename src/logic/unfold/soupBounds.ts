import type {
  Bbox2d,
  FaceIndex,
  FlattenedTriangleSoup,
  MeshModel,
  VertexIndex,
} from "../mesh/types";

const EMPTY_BBOX: Bbox2d = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

/** Axis-aligned bounds of all vertices in a triangle soup. */
export function boundsFromSoup(soup: FlattenedTriangleSoup): Bbox2d {
  if (soup.length === 0) return { ...EMPTY_BBOX };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < soup.length; i += 2) {
    const x = soup[i]!;
    const y = soup[i + 1]!;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return { minX, minY, maxX, maxY };
}

/** Returns a new soup with `(dx, dy)` added to every vertex. */
export function translateSoup(
  soup: FlattenedTriangleSoup,
  dx: number,
  dy: number,
): Float32Array {
  const out = new Float32Array(soup);
  for (let i = 0; i < out.length; i += 2) {
    out[i]! += dx;
    out[i + 1]! += dy;
  }
  return out;
}

export function mergeBounds(a: Bbox2d, b: Bbox2d): Bbox2d {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/** 2D corner for a vertex on one face slice in the soup (face-aware). */
export function corner2dForVertexOnFaceSlice(
  mesh: MeshModel,
  faceId: FaceIndex,
  soup: FlattenedTriangleSoup,
  faceIdxInSoup: number,
  vi: VertexIndex,
): { x: number; y: number } | null {
  const faceBase = 3 * faceId;
  const soupOff = 6 * faceIdxInSoup;
  for (let i = 0; i < 3; i++) {
    if (mesh.faces[faceBase + i] === vi) {
      const cornerOff = soupOff + 2 * i;
      return { x: soup[cornerOff]!, y: soup[cornerOff + 1]! };
    }
  }
  return null;
}

/** SVG `points` attribute for one face slice in the soup. */
export function polygonPointsString(
  soup: FlattenedTriangleSoup,
  faceIndexInSoup: number,
): string {
  const off = 6 * faceIndexInSoup;
  return [
    `${soup[off]!},${soup[off + 1]!}`,
    `${soup[off + 2]!},${soup[off + 3]!}`,
    `${soup[off + 4]!},${soup[off + 5]!}`,
  ].join(" ");
}

export function bboxWidth(bounds: Bbox2d): number {
  return bounds.maxX - bounds.minX;
}

export function bboxHeight(bounds: Bbox2d): number {
  return bounds.maxY - bounds.minY;
}

export function bboxArea(bounds: Bbox2d): number {
  return bboxWidth(bounds) * bboxHeight(bounds);
}
