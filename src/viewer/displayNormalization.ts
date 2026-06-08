import { SCENE_TARGET_RADIUS } from "./sceneScale";

/**
 * Single source of truth for display-space vertex positions.
 *
 * Takes canonical OBJ coordinates and returns a new packed xyz buffer centered
 * at the bounding-box midpoint and scaled so the furthest vertex sits at
 * SCENE_TARGET_RADIUS. Never mutates the input array — store mesh data stays raw.
 */
export function computeDisplayVertices(
  canonicalVertices: Float32Array,
): Float32Array {
  const out = new Float32Array(canonicalVertices);

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < out.length; i += 3) {
    const x = out[i]!;
    const y = out[i + 1]!;
    const z = out[i + 2]!;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;

  for (let i = 0; i < out.length; i += 3) {
    out[i]! -= cx;
    out[i + 1]! -= cy;
    out[i + 2]! -= cz;
  }

  // After centering, max vertex distance equals the bounding-sphere radius.
  let maxDistSq = 0;
  for (let i = 0; i < out.length; i += 3) {
    const x = out[i]!;
    const y = out[i + 1]!;
    const z = out[i + 2]!;
    maxDistSq = Math.max(maxDistSq, x * x + y * y + z * z);
  }

  const radius = Math.sqrt(maxDistSq);
  if (radius < 1e-10) return out;

  const scale = SCENE_TARGET_RADIUS / radius;
  for (let i = 0; i < out.length; i++) {
    out[i]! *= scale;
  }

  return out;
}
