import { SCENE_TARGET_RADIUS } from "./sceneScale";

/** Affine map: display = (canonical - center) * scale */
export type DisplayNormalization = {
  centerX: number;
  centerY: number;
  centerZ: number;
  /** Multiplier from centered canonical → display. Degenerate meshes use 1. */
  scale: number;
};

export type Vec3Like = { x: number; y: number; z: number };

/**
 * Compute center + uniform scale used by display normalization (ADR 0100).
 * Same transform as `computeDisplayVertices`.
 */
export function computeDisplayNormalization(
  canonicalVertices: Float32Array,
): DisplayNormalization {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < canonicalVertices.length; i += 3) {
    const x = canonicalVertices[i]!;
    const y = canonicalVertices[i + 1]!;
    const z = canonicalVertices[i + 2]!;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }

  if (!Number.isFinite(minX)) {
    return { centerX: 0, centerY: 0, centerZ: 0, scale: 1 };
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  let maxDistSq = 0;
  for (let i = 0; i < canonicalVertices.length; i += 3) {
    const x = canonicalVertices[i]! - centerX;
    const y = canonicalVertices[i + 1]! - centerY;
    const z = canonicalVertices[i + 2]! - centerZ;
    maxDistSq = Math.max(maxDistSq, x * x + y * y + z * z);
  }

  const radius = Math.sqrt(maxDistSq);
  const scale = radius < 1e-10 ? 1 : SCENE_TARGET_RADIUS / radius;
  return { centerX, centerY, centerZ, scale };
}

/**
 * Single source of truth for display-space vertex positions.
 *
 * Takes canonical mesh coordinates and returns a new packed xyz buffer centered
 * at the bounding-box midpoint and scaled so the furthest vertex sits at
 * SCENE_TARGET_RADIUS. Never mutates the input array — store mesh data stays raw.
 */
export function computeDisplayVertices(
  canonicalVertices: Float32Array,
): Float32Array {
  const { centerX, centerY, centerZ, scale } =
    computeDisplayNormalization(canonicalVertices);
  const out = new Float32Array(canonicalVertices.length);
  for (let i = 0; i < canonicalVertices.length; i += 3) {
    out[i] = (canonicalVertices[i]! - centerX) * scale;
    out[i + 1] = (canonicalVertices[i + 1]! - centerY) * scale;
    out[i + 2] = (canonicalVertices[i + 2]! - centerZ) * scale;
  }
  return out;
}

/** Display-normalized point → canonical mesh space (ADR 0100 stroke coords). */
export function displayToCanonical(
  display: Vec3Like,
  norm: DisplayNormalization,
): Vec3Like {
  const inv = norm.scale === 0 ? 0 : 1 / norm.scale;
  return {
    x: display.x * inv + norm.centerX,
    y: display.y * inv + norm.centerY,
    z: display.z * inv + norm.centerZ,
  };
}

/** Canonical mesh point → display-normalized space (for stroke overlay). */
export function canonicalToDisplay(
  canonical: Vec3Like,
  norm: DisplayNormalization,
): Vec3Like {
  return {
    x: (canonical.x - norm.centerX) * norm.scale,
    y: (canonical.y - norm.centerY) * norm.scale,
    z: (canonical.z - norm.centerZ) * norm.scale,
  };
}
