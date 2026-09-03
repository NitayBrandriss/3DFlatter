import { makeEdgeKey } from "../mesh/edgeKey";
import type { EdgeKey, FaceIndex, MeshModel } from "../mesh/types";
import type { CutStroke, Vec3 } from "../cuts/types";

export function makeMesh(vertices: number[], faces: number[]): MeshModel {
  return {
    vertices: new Float32Array(vertices),
    faces: new Uint32Array(faces),
    vertexCount: vertices.length / 3,
    faceCount: faces.length / 3,
  };
}

/**
 * Open cylinder (no caps): `rings` vertex loops along +Y, `sides` verts each.
 * Band `b` (between rings b and b+1) has `2 * sides` triangles starting at
 * face index `b * 2 * sides`.
 */
export function openTube(rings: number, sides: number): MeshModel {
  const verts: number[] = [];
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < sides; s++) {
      const a = (2 * Math.PI * s) / sides;
      verts.push(Math.cos(a), r, Math.sin(a));
    }
  }
  const faces: number[] = [];
  for (let r = 0; r < rings - 1; r++) {
    for (let s = 0; s < sides; s++) {
      const s2 = (s + 1) % sides;
      const a = r * sides + s;
      const b = r * sides + s2;
      const c = (r + 1) * sides + s2;
      const d = (r + 1) * sides + s;
      faces.push(a, b, c, a, c, d);
    }
  }
  return makeMesh(verts, faces);
}

export function tubeVertex(ring: number, side: number, sides: number): number {
  return ring * sides + side;
}

export function tubeBandFaces(band: number, sides: number): FaceIndex[] {
  const start = band * sides * 2;
  const count = sides * 2;
  const out: FaceIndex[] = [];
  for (let i = 0; i < count; i++) out.push(start + i);
  return out;
}

/** Closed edge loop around vertex ring `ring` (separating cycle on the tube). */
export function tubeCircumferentialLoop(
  ring: number,
  sides: number,
): Set<EdgeKey> {
  const keys = new Set<EdgeKey>();
  for (let s = 0; s < sides; s++) {
    keys.add(
      makeEdgeKey(
        tubeVertex(ring, s, sides),
        tubeVertex(ring, (s + 1) % sides, sides),
      ),
    );
  }
  return keys;
}

function readVertex(mesh: MeshModel, i: number): Vec3 {
  return {
    x: mesh.vertices[3 * i]!,
    y: mesh.vertices[3 * i + 1]!,
    z: mesh.vertices[3 * i + 2]!,
  };
}

/** Closed bracelet through band `band` via longitudinal-edge midpoints. */
export function tubeBraceletStroke(
  mesh: MeshModel,
  id: string,
  band: number,
  sides: number,
): CutStroke {
  const points: Vec3[] = [];
  for (let s = 0; s <= sides; s++) {
    const side = s % sides;
    const a = readVertex(mesh, tubeVertex(band, side, sides));
    const b = readVertex(mesh, tubeVertex(band + 1, side, sides));
    points.push({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      z: (a.z + b.z) / 2,
    });
  }
  return { id, points };
}
