import type { MeshModel } from "../mesh/types";
import type { CutStroke, Vec3 } from "./types";

export function makeMesh(vertices: number[], faces: number[]): MeshModel {
  return {
    vertices: new Float32Array(vertices),
    faces: new Uint32Array(faces),
    vertexCount: vertices.length / 3,
    faceCount: faces.length / 3,
  };
}

export function unitTriangle(): MeshModel {
  return makeMesh([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2]);
}

export function unitQuad(): MeshModel {
  return makeMesh(
    [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
    [0, 1, 2, 0, 2, 3],
  );
}

/** Unit cube centered at origin, 12 tris, closed manifold. */
export function unitCube(): MeshModel {
  const p = [
    [-0.5, -0.5, -0.5],
    [0.5, -0.5, -0.5],
    [0.5, 0.5, -0.5],
    [-0.5, 0.5, -0.5],
    [-0.5, -0.5, 0.5],
    [0.5, -0.5, 0.5],
    [0.5, 0.5, 0.5],
    [-0.5, 0.5, 0.5],
  ];
  const verts: number[] = [];
  for (const [x, y, z] of p) verts.push(x!, y!, z!);
  const faces = [
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    2, 6, 7, 2, 7, 3,
    0, 3, 7, 0, 7, 4,
    1, 5, 6, 1, 6, 2,
  ];
  return makeMesh(verts, faces);
}

/** Two triangles sharing edge (0,0,0)–(0,1,0) at 90° (z=0 wing + x=0 wing). */
export function foldedDihedralQuad(): MeshModel {
  return makeMesh(
    [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
    [0, 1, 2, 0, 2, 3],
  );
}

export function stroke(id: string, points: Vec3[]): CutStroke {
  return { id, points };
}

export function v(x: number, y: number, z = 0): Vec3 {
  return { x, y, z };
}

export function readV(mesh: MeshModel, i: number): Vec3 {
  return {
    x: mesh.vertices[3 * i]!,
    y: mesh.vertices[3 * i + 1]!,
    z: mesh.vertices[3 * i + 2]!,
  };
}

export function findClosestVertex(mesh: MeshModel, p: Vec3): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < mesh.vertexCount; i++) {
    const dx = mesh.vertices[3 * i]! - p.x;
    const dy = mesh.vertices[3 * i + 1]! - p.y;
    const dz = mesh.vertices[3 * i + 2]! - p.z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
