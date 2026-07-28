import { makeEdgeKey } from "../mesh/edgeKey";
import type { EdgeKey, MeshModel } from "../mesh/types";
import type { Vec3 } from "./types";
import {
  barycentric,
  closestOnSegment,
  distSq,
  lerp,
  readVertex,
  vec3,
} from "./vec3";

export type Tri = [number, number, number];

export type PointLocation =
  | { kind: "vertex"; vi: number }
  | { kind: "edge"; a: number; b: number; t: number }
  | { kind: "face"; faceIndex: number; point: Vec3 }
  | { kind: "none" };

/**
 * Mutable triangulated mesh used during materialize.
 * Seam keys remapped whenever an edged split replaces a parent edge.
 */
export class WorkingMesh {
  positions: number[];
  faces: Tri[];
  seams: Set<EdgeKey>;
  readonly eps: number;
  readonly epsSq: number;

  constructor(mesh: MeshModel, seams: Iterable<EdgeKey>, eps: number) {
    this.positions = Array.from(mesh.vertices);
    this.faces = [];
    for (let fi = 0; fi < mesh.faceCount; fi++) {
      const base = 3 * fi;
      this.faces.push([
        mesh.faces[base]!,
        mesh.faces[base + 1]!,
        mesh.faces[base + 2]!,
      ]);
    }
    this.seams = new Set(seams);
    this.eps = eps;
    this.epsSq = eps * eps;
  }

  vertexCount(): number {
    return this.positions.length / 3;
  }

  getVertex(vi: number): Vec3 {
    return readVertex(this.positions, vi);
  }

  addVertex(p: Vec3): number {
    const vi = this.vertexCount();
    this.positions.push(p.x, p.y, p.z);
    return vi;
  }

  /** Unique undirected edges as sorted endpoint pairs. */
  private uniqueEdges(): Array<[number, number]> {
    const seen = new Set<string>();
    const out: Array<[number, number]> = [];
    for (const [a, b, c] of this.faces) {
      for (const [u, v] of [
        [a, b],
        [b, c],
        [c, a],
      ] as const) {
        const key = makeEdgeKey(u, v);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(u < v ? [u, v] : [v, u]);
      }
    }
    return out;
  }

  faceIndicesWithEdge(a: number, b: number): number[] {
    const out: number[] = [];
    for (let fi = 0; fi < this.faces.length; fi++) {
      const [x, y, z] = this.faces[fi]!;
      if (
        (x === a && y === b) ||
        (y === a && z === b) ||
        (z === a && x === b) ||
        (x === b && y === a) ||
        (y === b && z === a) ||
        (z === b && x === a)
      ) {
        out.push(fi);
      }
    }
    return out;
  }

  hasEdge(a: number, b: number): boolean {
    return this.faceIndicesWithEdge(a, b).length > 0;
  }

  markSeam(a: number, b: number): EdgeKey {
    const key = makeEdgeKey(a, b);
    this.seams.add(key);
    return key;
  }

  /**
   * Insert vertex at lerp(a,b,t) (or reuse if already present near that point).
   * Splits all incident faces; remaps seam membership from (a,b) to children.
   */
  splitEdge(a: number, b: number, t: number): number {
    const pa = this.getVertex(a);
    const pb = this.getVertex(b);
    const point = lerp(pa, pb, t);

    // Reuse a vertex already on edge ab near the target
    if (this.hasEdge(a, b)) {
      for (let vi = 0; vi < this.vertexCount(); vi++) {
        if (vi === a || vi === b) continue;
        if (distSq(this.getVertex(vi), point) > this.epsSq) continue;
        const { distSq: d } = closestOnSegment(this.getVertex(vi), pa, pb);
        if (d <= this.epsSq) {
          // Near target and on the chord — if ab still present, keep splitting with new mid
          // unless vi already bridges a–vi–b
          if (this.hasEdge(a, vi) && this.hasEdge(vi, b)) {
            return vi;
          }
        }
      }
    } else {
      // Edge already subdivided: find existing bridge vertex nearest to t
      let best = -1;
      let bestD = this.epsSq;
      for (let vi = 0; vi < this.vertexCount(); vi++) {
        if (!this.hasEdge(a, vi) || !this.hasEdge(vi, b)) continue;
        const d = distSq(this.getVertex(vi), point);
        if (d <= bestD) {
          bestD = d;
          best = vi;
        }
      }
      if (best >= 0) return best;
    }

    for (let vi = 0; vi < this.vertexCount(); vi++) {
      if (distSq(this.getVertex(vi), point) <= this.epsSq) {
        if (vi === a || vi === b) return vi;
      }
    }

    const mid = this.addVertex(point);
    const parent = makeEdgeKey(a, b);
    const childA = makeEdgeKey(a, mid);
    const childB = makeEdgeKey(mid, b);
    if (this.seams.has(parent)) {
      this.seams.delete(parent);
      this.seams.add(childA);
      this.seams.add(childB);
    }

    // Split faces from high index to low so splice indices stay valid
    const incident = this.faceIndicesWithEdge(a, b).sort((x, y) => y - x);
    for (const fi of incident) {
      const [x, y, z] = this.faces[fi]!;
      let third = x;
      if ((x === a || x === b) && (y === a || y === b)) third = z;
      else if ((y === a || y === b) && (z === a || z === b)) third = x;
      else third = y;

      // Preserve winding of directed edge a→b or b→a as in the face
      const replacement = splitTriWinding([x, y, z], a, b, mid, third);
      this.faces.splice(fi, 1, ...replacement);
    }

    return mid;
  }

  /** Fan-split a face around an interior Steiner point. */
  insertInterior(faceIndex: number, p: Vec3): number {
    // Reuse nearby vertex
    for (let vi = 0; vi < this.vertexCount(); vi++) {
      if (distSq(this.getVertex(vi), p) <= this.epsSq) {
        return vi;
      }
    }
    const [a, b, c] = this.faces[faceIndex]!;
    const v = this.addVertex(p);
    this.faces.splice(faceIndex, 1, [a, b, v], [b, c, v], [c, a, v]);
    return v;
  }

  locate(p: Vec3): PointLocation {
    let bestVi = -1;
    let bestD = this.epsSq;
    for (let vi = 0; vi < this.vertexCount(); vi++) {
      const d = distSq(this.getVertex(vi), p);
      if (d <= bestD) {
        bestD = d;
        bestVi = vi;
      }
    }
    if (bestVi >= 0) {
      return { kind: "vertex", vi: bestVi };
    }

    let bestEdge: { a: number; b: number; t: number; d: number } | null = null;
    for (const [a, b] of this.uniqueEdges()) {
      const { point, t, distSq: d } = closestOnSegment(
        p,
        this.getVertex(a),
        this.getVertex(b),
      );
      void point;
      if (d <= this.epsSq && (bestEdge === null || d < bestEdge.d)) {
        bestEdge = { a, b, t, d };
      }
    }
    if (bestEdge) {
      return { kind: "edge", a: bestEdge.a, b: bestEdge.b, t: bestEdge.t };
    }

    // Face interior: near plane + barycentric inside
    let bestFace = -1;
    let bestFaceD = this.epsSq * 100; // slightly looser plane distance
    let bestPoint = p;
    for (let fi = 0; fi < this.faces.length; fi++) {
      const [ia, ib, ic] = this.faces[fi]!;
      const a = this.getVertex(ia);
      const b = this.getVertex(ib);
      const c = this.getVertex(ic);
      const bary = barycentric(p, a, b, c);
      if (!bary) continue;
      const { u, v, w } = bary;
      const planePoint = vec3(
        u * a.x + v * b.x + w * c.x,
        u * a.y + v * b.y + w * c.y,
        u * a.z + v * b.z + w * c.z,
      );
      const dPlane = distSq(p, planePoint);
      // Inside or on boundary (with small slack)
      const slack = 1e-4;
      if (u >= -slack && v >= -slack && w >= -slack && dPlane <= bestFaceD) {
        // Prefer strict interior for face kind; boundary should have been edge/vertex
        if (u > slack && v > slack && w > slack) {
          bestFaceD = dPlane;
          bestFace = fi;
          bestPoint = planePoint;
        } else if (bestFace < 0 && dPlane <= this.epsSq) {
          // On boundary but missed edge snap — treat via bary → edge
          bestFaceD = dPlane;
          bestFace = fi;
          bestPoint = planePoint;
        }
      }
    }
    if (bestFace >= 0) {
      const [ia, ib, ic] = this.faces[bestFace]!;
      const a = this.getVertex(ia);
      const b = this.getVertex(ib);
      const c = this.getVertex(ic);
      const bary = barycentric(bestPoint, a, b, c);
      if (bary) {
        const slack = 1e-4;
        // Degenerate to edge if nearly on boundary
        if (bary.u <= slack) {
          const { t } = closestOnSegment(bestPoint, b, c);
          return { kind: "edge", a: ib, b: ic, t };
        }
        if (bary.v <= slack) {
          const { t } = closestOnSegment(bestPoint, c, a);
          return { kind: "edge", a: ic, b: ia, t };
        }
        if (bary.w <= slack) {
          const { t } = closestOnSegment(bestPoint, a, b);
          return { kind: "edge", a: ia, b: ib, t };
        }
      }
      return { kind: "face", faceIndex: bestFace, point: bestPoint };
    }

    return { kind: "none" };
  }

  /** Ensure a located point exists as a vertex; returns vertex index. */
  ensureVertex(loc: PointLocation): number | null {
    if (loc.kind === "vertex") return loc.vi;
    if (loc.kind === "edge") return this.splitEdge(loc.a, loc.b, loc.t);
    if (loc.kind === "face") return this.insertInterior(loc.faceIndex, loc.point);
    return null;
  }

  toMeshModel(): MeshModel {
    const vertexCount = this.vertexCount();
    const faceCount = this.faces.length;
    const vertices = new Float32Array(this.positions);
    const faces = new Uint32Array(faceCount * 3);
    for (let fi = 0; fi < faceCount; fi++) {
      const [a, b, c] = this.faces[fi]!;
      const base = 3 * fi;
      faces[base] = a;
      faces[base + 1] = b;
      faces[base + 2] = c;
    }
    return { vertices, faces, vertexCount, faceCount };
  }

  /** True if vertex lies on some boundary edge (incident count === 1). */
  isBoundaryVertex(vi: number): boolean {
    const edgeCount = new Map<string, number>();
    for (const [a, b, c] of this.faces) {
      for (const [u, v] of [
        [a, b],
        [b, c],
        [c, a],
      ] as const) {
        const key = makeEdgeKey(u, v);
        edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
      }
    }
    for (const [key, count] of edgeCount) {
      if (count !== 1) continue;
      const comma = key.indexOf(",");
      const a = Number(key.slice(0, comma));
      const b = Number(key.slice(comma + 1));
      if (a === vi || b === vi) return true;
    }
    return false;
  }
}

/** Split triangle so edge (a,b) is replaced by (a,mid)+(mid,b), preserving winding. */
function splitTriWinding(
  tri: Tri,
  a: number,
  b: number,
  mid: number,
  third: number,
): Tri[] {
  const [x, y, z] = tri;
  // Walk corners; when we see directed edge a→b or b→a, insert mid
  const verts = [x, y, z];
  for (let i = 0; i < 3; i++) {
    const u = verts[i]!;
    const v = verts[(i + 1) % 3]!;
    if (u === a && v === b) {
      return [
        [a, mid, third],
        [mid, b, third],
      ];
    }
    if (u === b && v === a) {
      return [
        [b, mid, third],
        [mid, a, third],
      ];
    }
  }
  // Fallback: undirected match
  return [
    [a, mid, third],
    [mid, b, third],
  ];
}
