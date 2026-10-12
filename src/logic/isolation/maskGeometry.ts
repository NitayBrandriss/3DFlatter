import type { FaceIndex, MeshModel } from "../mesh/types";
import type { FaceMask } from "./types";

/**
 * Axis-aligned center plus radius of a display-space point set.
 * Center is the box midpoint; radius is the furthest sample from that center.
 * Callers pass an already-normalized position buffer — this module does not
 * scale or import display normalization.
 */
export type DisplayBounds = {
  centerX: number;
  centerY: number;
  centerZ: number;
  radius: number;
};

export type IsolationIndexSplit = {
  /** Triangle corners for mask bit 1, ascending original face id. */
  isolateIndices: Uint32Array;
  /** Triangle corners for mask bit 0, ascending original face id. */
  ghostIndices: Uint32Array;
  /**
   * Original face ids parallel to isolate triangles.
   * Three.js `faceIndex` on the isolate buffer is an index into this list.
   */
  isolateFaceIds: FaceIndex[];
};

function boundsFromVisit(
  visit: (fn: (x: number, y: number, z: number) => void) => void,
): DisplayBounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let n = 0;

  visit((x, y, z) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
    n++;
  });

  if (n === 0 || !Number.isFinite(minX)) return null;

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  let maxDistSq = 0;

  visit((x, y, z) => {
    const dx = x - centerX;
    const dy = y - centerY;
    const dz = z - centerZ;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq > maxDistSq) maxDistSq = distSq;
  });

  return { centerX, centerY, centerZ, radius: Math.sqrt(maxDistSq) };
}

/** Bounds of every vertex in a display position buffer (full mesh). */
export function displayBoundsOfPositions(
  positions: Float32Array,
): DisplayBounds | null {
  return boundsFromVisit((fn) => {
    for (let i = 0; i + 2 < positions.length; i += 3) {
      fn(positions[i]!, positions[i + 1]!, positions[i + 2]!);
    }
  });
}

/**
 * Bounds of vertices referenced by `isolateIndices` (a triangle index buffer).
 * Positions stay the full display buffer; unreferenced vertices do not pull
 * the center back to the whole mesh.
 */
export function isolateDisplayBounds(
  displayPositions: Float32Array,
  isolateIndices: Uint32Array,
): DisplayBounds | null {
  if (isolateIndices.length === 0) return null;
  return boundsFromVisit((fn) => {
    for (let i = 0; i < isolateIndices.length; i++) {
      const base = isolateIndices[i]! * 3;
      if (base < 0 || base + 2 >= displayPositions.length) continue;
      fn(
        displayPositions[base]!,
        displayPositions[base + 1]!,
        displayPositions[base + 2]!,
      );
    }
  });
}

/**
 * Split a mesh index buffer by mask bit. Face order is ascending original id.
 * A short mask treats the missing tail as ghost. Extra mask bits are ignored.
 */
export function splitIsolationIndexBuffers(
  mesh: MeshModel,
  mask: FaceMask,
): IsolationIndexSplit {
  const faceCount = mesh.faceCount;
  let isolateFaces = 0;
  for (let face = 0; face < faceCount; face++) {
    if (face < mask.length && mask[face]) isolateFaces++;
  }
  const ghostFaces = faceCount - isolateFaces;
  const isolateIndices = new Uint32Array(isolateFaces * 3);
  const ghostIndices = new Uint32Array(ghostFaces * 3);
  const isolateFaceIds: FaceIndex[] = [];
  let isolateWrite = 0;
  let ghostWrite = 0;

  for (let face = 0; face < faceCount; face++) {
    const base = face * 3;
    const a = mesh.faces[base]!;
    const b = mesh.faces[base + 1]!;
    const c = mesh.faces[base + 2]!;
    if (face < mask.length && mask[face]) {
      isolateIndices[isolateWrite++] = a;
      isolateIndices[isolateWrite++] = b;
      isolateIndices[isolateWrite++] = c;
      isolateFaceIds.push(face);
    } else {
      ghostIndices[ghostWrite++] = a;
      ghostIndices[ghostWrite++] = b;
      ghostIndices[ghostWrite++] = c;
    }
  }

  return { isolateIndices, ghostIndices, isolateFaceIds };
}

/**
 * Isolate-buffer `faceIndex` → original session face.
 * A null map means the pick buffer is the full mesh, so the index is already original.
 */
export function originalFaceIdForHit(
  subsetFaceIndex: number,
  isolateFaceIds: readonly FaceIndex[] | null,
): FaceIndex | null {
  if (!Number.isInteger(subsetFaceIndex) || subsetFaceIndex < 0) return null;
  if (isolateFaceIds == null) return subsetFaceIndex;
  const faceId = isolateFaceIds[subsetFaceIndex];
  return faceId === undefined ? null : faceId;
}
