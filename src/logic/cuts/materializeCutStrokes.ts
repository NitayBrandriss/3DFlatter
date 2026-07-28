import { buildTopology } from "../mesh/buildTopology";
import { makeEdgeKey } from "../mesh/edgeKey";
import type { EdgeKey, MeshModel, SeamRegistry } from "../mesh/types";
import type {
  CutManifestEntry,
  CutStroke,
  MaterializeCutStrokesResult,
  OpenLoopInfo,
  Vec3,
} from "./types";
import { distSq, snapEpsilonForMesh } from "./vec3";
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
  const working = new WorkingMesh(mesh, seamSet, eps);
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

      if (seg === 0 && keys.length >= 0) {
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
          `Cut stroke "${stroke.id}" is an open loop (interior endpoint); unfold may not split islands`,
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
  // After cuts, endpoint should snap to a vertex
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
  if (v0 === v1) return [];

  return connectCut(working, v0, v1, p0, p1, warnings, strokeId);
}

function locationPriority(loc: PointLocation): number {
  if (loc.kind === "vertex") return 0;
  if (loc.kind === "edge") return 1;
  if (loc.kind === "face") return 2;
  return 3;
}

function connectCut(
  working: WorkingMesh,
  v0: number,
  v1: number,
  p0: Vec3,
  p1: Vec3,
  warnings: string[],
  strokeId: string,
): EdgeKey[] {
  if (working.hasEdge(v0, v1)) {
    return [working.markSeam(v0, v1)];
  }

  // Shared triangle without existing... impossible for two corners.
  // Adjacent-face bridge via shared edge.
  const faces0 = facesIncidentToVertex(working, v0);
  const faces1 = new Set(facesIncidentToVertex(working, v1));

  for (const fi of faces0) {
    if (!faces1.has(fi)) continue;
    // Same face but missing edge — should not happen for a triangle
    const tri = working.faces[fi]!;
    if (tri.includes(v0) && tri.includes(v1)) {
      return [working.markSeam(v0, v1)];
    }
  }

  // Find neighboring face pair with a shared edge between the two vertex stars
  const bridge = findBridgeEdge(working, v0, v1);
  if (bridge) {
    const { a, b } = bridge;
    const pa = working.getVertex(a);
    const pb = working.getVertex(b);
    // Parameter of closest point on ab to midpoint of segment (surface approximation)
    const mid = {
      x: (p0.x + p1.x) * 0.5,
      y: (p0.y + p1.y) * 0.5,
      z: (p0.z + p1.z) * 0.5,
    };
    const abx = pb.x - pa.x;
    const aby = pb.y - pa.y;
    const abz = pb.z - pa.z;
    const lenSq = abx * abx + aby * aby + abz * abz;
    let t = 0.5;
    if (lenSq > working.epsSq) {
      t = ((mid.x - pa.x) * abx + (mid.y - pa.y) * aby + (mid.z - pa.z) * abz) / lenSq;
      t = Math.max(working.eps, Math.min(1 - working.eps, t));
    }
    const vm = working.splitEdge(a, b, t);
    const keys: EdgeKey[] = [];
    if (v0 !== vm && working.hasEdge(v0, vm)) keys.push(working.markSeam(v0, vm));
    if (vm !== v1 && working.hasEdge(vm, v1)) keys.push(working.markSeam(vm, v1));
    if (keys.length === 0) {
      // After split, fan spokes may need explicit connection — try mark if edges appear
      if (working.hasEdge(v0, vm)) keys.push(working.markSeam(v0, vm));
      if (working.hasEdge(vm, v1)) keys.push(working.markSeam(vm, v1));
    }
    return keys;
  }

  warnings.push(
    `Cut stroke "${strokeId}": could not connect segment across faces; skipped`,
  );
  return [];
}

function facesIncidentToVertex(working: WorkingMesh, vi: number): number[] {
  const out: number[] = [];
  for (let fi = 0; fi < working.faces.length; fi++) {
    if (working.faces[fi]!.includes(vi)) out.push(fi);
  }
  return out;
}

/**
 * Shared mesh edge that borders both the face-star of v0 and of v1
 * (typical adjacent-face cut).
 */
function findBridgeEdge(
  working: WorkingMesh,
  v0: number,
  v1: number,
): { a: number; b: number } | null {
  const edges0 = new Set<EdgeKey>();
  for (const fi of facesIncidentToVertex(working, v0)) {
    const [a, b, c] = working.faces[fi]!;
    edges0.add(makeEdgeKey(a, b));
    edges0.add(makeEdgeKey(b, c));
    edges0.add(makeEdgeKey(c, a));
  }
  for (const fi of facesIncidentToVertex(working, v1)) {
    const [a, b, c] = working.faces[fi]!;
    for (const [u, v] of [
      [a, b],
      [b, c],
      [c, a],
    ] as const) {
      const key = makeEdgeKey(u, v);
      if (!edges0.has(key)) continue;
      // Prefer edges that are not incident to both endpoints already
      if (u === v0 || v === v0 || u === v1 || v === v1) continue;
      return { a: u, b: v };
    }
  }
  // Fallback: any shared edge between the two stars (including spokes)
  for (const fi of facesIncidentToVertex(working, v1)) {
    const [a, b, c] = working.faces[fi]!;
    for (const [u, v] of [
      [a, b],
      [b, c],
      [c, a],
    ] as const) {
      const key = makeEdgeKey(u, v);
      if (edges0.has(key) && u !== v0 && v !== v0 && u !== v1 && v !== v1) {
        return { a: u, b: v };
      }
    }
  }
  return null;
}

/** Axis-aligned 2D self-intersection of the polyline (XY projection of deltas). */
function strokeSelfIntersects(points: readonly Vec3[], eps: number): boolean {
  if (points.length < 4) return false;
  // Proper segment intersection in a local frame is expensive; use 3D segment pairs
  // with shared-endpoint exclusion — sufficient for planar face zigzags.
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    for (let j = i + 2; j < points.length - 1; j++) {
      // Adjacent segments share a vertex when j === i+1; skip those
      if (j === i + 1) continue;
      // Allow closed stroke: last segment may touch first endpoint
      if (i === 0 && j === points.length - 2) continue;
      const c = points[j]!;
      const d = points[j + 1]!;
      if (segmentsProperIntersect3d(a, b, c, d, eps)) return true;
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
): boolean {
  // Closest points between skew segments; treat as intersect if very close and
  // parameters strictly inside (0,1).
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const cd = { x: d.x - c.x, y: d.y - c.y, z: d.z - c.z };
  const ac = { x: a.x - c.x, y: a.y - c.y, z: a.z - c.z };
  const abab = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z;
  const cdcd = cd.x * cd.x + cd.y * cd.y + cd.z * cd.z;
  const abcd = ab.x * cd.x + ab.y * cd.y + ab.z * cd.z;
  const abac = ab.x * ac.x + ab.y * ac.y + ab.z * ac.z;
  const cdac = cd.x * ac.x + cd.y * ac.y + cd.z * ac.z;
  const denom = abab * cdcd - abcd * abcd;
  if (Math.abs(denom) < eps * eps) return false;
  const t = (abcd * cdac - cdcd * abac) / denom;
  const u = (abab * cdac - abcd * abac) / denom;
  if (t <= eps || t >= 1 - eps || u <= eps || u >= 1 - eps) return false;
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
