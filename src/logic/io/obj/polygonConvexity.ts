const EPS = 1e-6;

function readVertex3(
  vertices: Float32Array | number[],
  vi: number,
): [number, number, number] {
  const base = 3 * vi;
  return [vertices[base]!, vertices[base + 1]!, vertices[base + 2]!];
}

function cross3(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): [number, number, number] {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

function dot3(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  return ax * bx + ay * by + az * bz;
}

/** Newell's method — robust normal for nearly-planar polygons. */
function newellNormal(
  vertices: Float32Array | number[],
  polygon: readonly number[],
): [number, number, number] {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const [x0, y0, z0] = readVertex3(vertices, polygon[i]!);
    const [x1, y1, z1] = readVertex3(vertices, polygon[(i + 1) % n]!);
    nx += (y0 - y1) * (z0 + z1);
    ny += (z0 - z1) * (x0 + x1);
    nz += (x0 - x1) * (y0 + y1);
  }

  return [nx, ny, nz];
}

/**
 * Returns true when a polygon face (n > 3) is concave in 3D.
 * Triangles are always treated as convex (caller should skip n <= 3).
 *
 * Uses cross-product sign consistency relative to a Newell normal.
 * Assumes approximately planar OBJ faces; severely non-planar quads may false-positive.
 */
export function isConcaveNgons(
  vertices: Float32Array | number[],
  polygon: readonly number[],
): boolean {
  const n = polygon.length;
  if (n <= 3) return false;

  const [nx, ny, nz] = newellNormal(vertices, polygon);
  const normalLen = Math.hypot(nx, ny, nz);
  if (normalLen < EPS) return false;

  let sign = 0;

  for (let i = 0; i < n; i++) {
    const prev = polygon[(i + n - 1) % n]!;
    const curr = polygon[i]!;
    const next = polygon[(i + 1) % n]!;

    const [px, py, pz] = readVertex3(vertices, prev);
    const [cx, cy, cz] = readVertex3(vertices, curr);
    const [nxtX, nxtY, nxtZ] = readVertex3(vertices, next);

    const e1x = cx - px;
    const e1y = cy - py;
    const e1z = cz - pz;
    const e2x = nxtX - cx;
    const e2y = nxtY - cy;
    const e2z = nxtZ - cz;

    const [cxp, cyp, czp] = cross3(e1x, e1y, e1z, e2x, e2y, e2z);
    const d = dot3(cxp, cyp, czp, nx, ny, nz);
    if (Math.abs(d) < EPS) continue;

    const s = d > 0 ? 1 : -1;
    if (sign === 0) {
      sign = s;
    } else if (s !== sign) {
      return true;
    }
  }

  return false;
}
