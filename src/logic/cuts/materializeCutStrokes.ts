import { buildTopology } from "../mesh/buildTopology";
import type { EdgeKey, MeshModel, SeamRegistry } from "../mesh/types";
import type {
  CutManifestEntry,
  CutStroke,
  MaterializeCutStrokesResult,
  OpenLoopInfo,
  Vec3,
} from "./types";
import {
  distSq,
  PARAM_EPS,
  snapEpsilonForMesh,
  surfaceEpsilonForMesh,
} from "./vec3";
import { WorkingMesh, type PointLocation } from "./workingMesh";
export type { CutStroke, MaterializeCutStrokesResult, Vec3 } from "./types";

/**
 * Subdivide `mesh` along freeform cut strokes and union with manual seams.
 * Pure function (ADR 0100). Does not mutate inputs.
 *
 * Pipeline stage: seams → (derived) islands / unfold inputs.
 */
export function materializeCutStrokes(
  mesh: MeshModel,
  strokes: readonly CutStroke[],
  manualSeams: SeamRegistry | Set<EdgeKey>,
): MaterializeCutStrokesResult {
  const seamSet =
    manualSeams instanceof Set ? manualSeams : manualSeams.seams;
  const eps = snapEpsilonForMesh(mesh);
  const surfaceEps = surfaceEpsilonForMesh(mesh);
  const working = new WorkingMesh(mesh, seamSet, eps, surfaceEps);
  const warnings: string[] = [];
  const manifest: CutManifestEntry[] = [];
  const openLoops: OpenLoopInfo[] = [];

  for (const stroke of strokes) {
    if (stroke.points.length < 2) {
      warnings.push(`Cut stroke "${stroke.id}" skipped: fewer than 2 points`);
      continue;
    }

    if (strokeSelfIntersects(stroke.points, eps)) {
      warnings.push(
        `Cut stroke "${stroke.id}" skipped: self-intersecting polyline`,
      );
      continue;
    }

    const endpointVerts: (number | null)[] = [null, null];

    for (let seg = 0; seg < stroke.points.length - 1; seg++) {
      const p0 = stroke.points[seg]!;
      const p1 = stroke.points[seg + 1]!;
      const keys = cutSegment(working, p0, p1, warnings, stroke.id);
      manifest.push({ strokeId: stroke.id, segmentIndex: seg, edgeKeys: keys });

      if (seg === 0) {
        endpointVerts[0] = resolveEndpointVertex(working, p0);
      }
      if (seg === stroke.points.length - 2) {
        endpointVerts[1] = resolveEndpointVertex(working, p1);
      }
    }

    const closed =
      distSq(stroke.points[0]!, stroke.points[stroke.points.length - 1]!) <=
      working.epsSq;

    if (!closed) {
      const interiorEndpoints: (0 | 1)[] = [];
      for (const end of [0, 1] as const) {
        const vi = endpointVerts[end];
        if (vi === null || !working.isBoundaryVertex(vi)) {
          interiorEndpoints.push(end);
        }
      }
      if (interiorEndpoints.length > 0) {
        openLoops.push({ strokeId: stroke.id, interiorEndpoints });
        warnings.push(
          `Cut stroke "${stroke.id}" is an open loop (endpoint not on a free boundary); may not split a closed shell`,
        );
      }
    }
  }

  const derived = working.toMeshModel();
  if (derived.faceCount === 0) {
    throw new Error("materializeCutStrokes: no faces remaining after materialize");
  }

  const topology = buildTopology(derived);
  return {
    mesh: derived,
    topology,
    seams: { seams: working.seams },
    warnings,
    manifest,
    validation: { openLoops },
  };
}

function resolveEndpointVertex(working: WorkingMesh, p: Vec3): number | null {
  const loc = working.locate(p);
  if (loc.kind === "vertex") return loc.vi;
  let best = -1;
  let bestD = working.epsSq;
  for (let vi = 0; vi < working.vertexCount(); vi++) {
    const d = distSq(working.getVertex(vi), p);
    if (d <= bestD) {
      bestD = d;
      best = vi;
    }
  }
  return best >= 0 ? best : null;
}

/**
 * Insert endpoints (edge/vertex before interior), then mark the cut edge(s) as seams.
 */
function cutSegment(
  working: WorkingMesh,
  p0: Vec3,
  p1: Vec3,
  warnings: string[],
  strokeId: string,
): EdgeKey[] {
  if (distSq(p0, p1) <= working.epsSq) {
    warnings.push(
      `Cut stroke "${strokeId}": segment collapsed under snap; skipped`,
    );
    return [];
  }

  const loc0 = working.locate(p0);
  const loc1 = working.locate(p1);

  if (loc0.kind === "none" || loc1.kind === "none") {
    warnings.push(
      `Cut stroke "${strokeId}": segment endpoint not on mesh surface; skipped`,
    );
    return [];
  }

  // Boundary features first so interior fans land on the updated triangulation
  const firstPoint =
    locationPriority(loc0) <= locationPriority(loc1) ? p0 : p1;
  const secondPoint = firstPoint === p0 ? p1 : p0;

  const insertAt = (p: Vec3): number | null => {
    const loc = working.locate(p);
    if (loc.kind === "none") return null;
    return working.ensureVertex(loc);
  };

  const vFirst = insertAt(firstPoint);
  const vSecond = insertAt(secondPoint);
  if (vFirst === null || vSecond === null) {
    warnings.push(
      `Cut stroke "${strokeId}": lost surface location after split; skipped`,
    );
    return [];
  }

  const v0 = firstPoint === p0 ? vFirst : vSecond;
  const v1 = firstPoint === p0 ? vSecond : vFirst;
  if (v0 === v1) {
    warnings.push(
      `Cut stroke "${strokeId}": segment collapsed under snap; skipped`,
    );
    return [];
  }

  return connectCut(working, v0, v1, warnings, strokeId);
}

function locationPriority(loc: PointLocation): number {
  if (loc.kind === "vertex") return 0;
  if (loc.kind === "edge") return 1;
  if (loc.kind === "face") return 2;
  return 3;
}

/**
 * Connect two existing vertices with a seam chain by walking face-to-face
 * along the chord, splitting crossed mesh edges (CUT-003).
 */
function connectCut(
  working: WorkingMesh,
  v0: number,
  v1: number,
  warnings: string[],
  strokeId: string,
): EdgeKey[] {
  if (working.hasEdge(v0, v1)) {
    return [working.markSeam(v0, v1)];
  }

  const keys: EdgeKey[] = [];
  let current = v0;
  const target = v1;
  const goal = working.getVertex(target);
  const maxHops = Math.max(8, working.faces.length * 2 + 4);
  let prev: number | null = null;

  for (let hop = 0; hop < maxHops; hop++) {
    if (working.hasEdge(current, target)) {
      keys.push(working.markSeam(current, target));
      return keys;
    }

    const exit = findExitEdge(working, current, goal, prev);
    if (!exit) {
      warnings.push(
        `Cut stroke "${strokeId}": could not connect segment across faces; skipped`,
      );
      return keys;
    }

    const { a, b, t } = exit;
    const mid = working.splitEdge(a, b, t);
    if (mid === current) {
      warnings.push(
        `Cut stroke "${strokeId}": could not connect segment across faces; skipped`,
      );
      return keys;
    }

    if (working.hasEdge(current, mid)) {
      keys.push(working.markSeam(current, mid));
    } else {
      warnings.push(
        `Cut stroke "${strokeId}": could not connect segment across faces; skipped`,
      );
      return keys;
    }

    prev = current;
    current = mid;

    if (current === target) {
      return keys;
    }
  }

  warnings.push(
    `Cut stroke "${strokeId}": could not connect segment across faces; skipped`,
  );
  return keys;
}

/**
 * Among faces incident to `current`, find the opposite-edge intersection with
 * the chord current→goal that has the smallest forward parameter.
 */
function findExitEdge(
  working: WorkingMesh,
  current: number,
  goal: Vec3,
  prev: number | null,
): { a: number; b: number; t: number } | null {
  const origin = working.getVertex(current);
  let best: { a: number; b: number; t: number; tSeg: number } | null = null;
  const hitEps = Math.max(working.surfaceEps, working.eps);

  for (const fi of working.facesOfVertex(current)) {
    const [x, y, z] = working.faces[fi]!;
    for (const [u, v] of [
      [x, y],
      [y, z],
      [z, x],
    ] as const) {
      if (u === current || v === current) continue;
      if (prev !== null && (u === prev || v === prev)) continue;

      const hit = segmentSegmentHit(
        origin,
        goal,
        working.getVertex(u),
        working.getVertex(v),
        hitEps,
      );
      if (!hit) continue;
      if (hit.tSeg <= PARAM_EPS || hit.tSeg >= 1 - PARAM_EPS) continue;
      const t = Math.max(PARAM_EPS, Math.min(1 - PARAM_EPS, hit.tEdge));
      if (best === null || hit.tSeg < best.tSeg) {
        best = { a: u, b: v, t, tSeg: hit.tSeg };
      }
    }
  }

  if (!best) return null;
  return { a: best.a, b: best.b, t: best.t };
}

/** Closest-point hit between two 3D segments; null if too far apart. */
function segmentSegmentHit(
  a: Vec3,
  b: Vec3,
  c: Vec3,
  d: Vec3,
  eps: number,
): { tSeg: number; tEdge: number } | null {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const cd = { x: d.x - c.x, y: d.y - c.y, z: d.z - c.z };
  const ac = { x: a.x - c.x, y: a.y - c.y, z: a.z - c.z };
  const abab = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z;
  const cdcd = cd.x * cd.x + cd.y * cd.y + cd.z * cd.z;
  const abcd = ab.x * cd.x + ab.y * cd.y + ab.z * cd.z;
  const abac = ab.x * ac.x + ab.y * ac.y + ab.z * ac.z;
  const cdac = cd.x * ac.x + cd.y * ac.y + cd.z * ac.z;
  const denom = abab * cdcd - abcd * abcd;
  const denomEps = Math.max(eps * eps, 1e-30);
  let tSeg: number;
  let tEdge: number;
  if (Math.abs(denom) < denomEps) {
    // Parallel / degenerate — project midpoint approach
    if (cdcd < denomEps) return null;
    tEdge = Math.max(0, Math.min(1, cdac / cdcd));
    if (abab < denomEps) return null;
    const cx = c.x + cd.x * tEdge - a.x;
    const cy = c.y + cd.y * tEdge - a.y;
    const cz = c.z + cd.z * tEdge - a.z;
    tSeg = Math.max(
      0,
      Math.min(1, (cx * ab.x + cy * ab.y + cz * ab.z) / abab),
    );
  } else {
    tSeg = (abcd * cdac - cdcd * abac) / denom;
    tEdge = (abab * cdac - abcd * abac) / denom;
  }
  if (tSeg < -PARAM_EPS || tSeg > 1 + PARAM_EPS) return null;
  if (tEdge < -PARAM_EPS || tEdge > 1 + PARAM_EPS) return null;
  tSeg = Math.max(0, Math.min(1, tSeg));
  tEdge = Math.max(0, Math.min(1, tEdge));
  const px = a.x + ab.x * tSeg;
  const py = a.y + ab.y * tSeg;
  const pz = a.z + ab.z * tSeg;
  const qx = c.x + cd.x * tEdge;
  const qy = c.y + cd.y * tEdge;
  const qz = c.z + cd.z * tEdge;
  const dx = px - qx;
  const dy = py - qy;
  const dz = pz - qz;
  if (dx * dx + dy * dy + dz * dz > eps * eps) return null;
  return { tSeg, tEdge };
}

/** Whole-stroke 3D proper self-intersection (ADR 0100 Phase 1). */
function strokeSelfIntersects(points: readonly Vec3[], eps: number): boolean {
  if (points.length < 4) return false;
  const closed =
    distSq(points[0]!, points[points.length - 1]!) <= eps * eps;
  const paramEps = 1e-6;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    for (let j = i + 2; j < points.length - 1; j++) {
      if (closed && i === 0 && j === points.length - 2) continue;
      const c = points[j]!;
      const d = points[j + 1]!;
      if (segmentsProperIntersect3d(a, b, c, d, eps, paramEps)) return true;
    }
  }
  return false;
}

function segmentsProperIntersect3d(
  a: Vec3,
  b: Vec3,
  c: Vec3,
  d: Vec3,
  eps: number,
  paramEps: number,
): boolean {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const cd = { x: d.x - c.x, y: d.y - c.y, z: d.z - c.z };
  const ac = { x: a.x - c.x, y: a.y - c.y, z: a.z - c.z };
  const abab = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z;
  const cdcd = cd.x * cd.x + cd.y * cd.y + cd.z * cd.z;
  const abcd = ab.x * cd.x + ab.y * cd.y + ab.z * cd.z;
  const abac = ab.x * ac.x + ab.y * ac.y + ab.z * ac.z;
  const cdac = cd.x * ac.x + cd.y * ac.y + cd.z * ac.z;
  const denom = abab * cdcd - abcd * abcd;
  const denomEps = Math.max(eps * eps, 1e-30);
  if (Math.abs(denom) < denomEps) return false;
  const t = (abcd * cdac - cdcd * abac) / denom;
  const u = (abab * cdac - abcd * abac) / denom;
  if (
    t <= paramEps ||
    t >= 1 - paramEps ||
    u <= paramEps ||
    u >= 1 - paramEps
  ) {
    return false;
  }
  const px = a.x + ab.x * t;
  const py = a.y + ab.y * t;
  const pz = a.z + ab.z * t;
  const qx = c.x + cd.x * u;
  const qy = c.y + cd.y * u;
  const qz = c.z + cd.z * u;
  const dx = px - qx;
  const dy = py - qy;
  const dz = pz - qz;
  return dx * dx + dy * dy + dz * dz <= eps * eps;
}
