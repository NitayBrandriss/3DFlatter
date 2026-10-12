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

/**
 * Closed bracelet through band `band` via longitudinal-edge midpoints.
 * Characterizing only — exit keys are often non-separating under hybrid fences.
 */
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

/**
 * Canonical bracelet: polyline snapped to vertex ring `ring` (closed cycle).
 * Exit keys should contain `tubeCircumferentialLoop(ring, sides)`.
 */
export function tubeRingBraceletStroke(
  mesh: MeshModel,
  id: string,
  ring: number,
  sides: number,
): CutStroke {
  const points: Vec3[] = [];
  for (let s = 0; s <= sides; s++) {
    points.push(readVertex(mesh, tubeVertex(ring, s % sides, sides)));
  }
  return { id, points };
}

/**
 * Same as tubeRingBraceletStroke but omit one segment (gapped cycle).
 * `omitSide` is the start side index of the missing edge (0..sides-1).
 * Returns an open chain from omitSide+1 around to omitSide (sides-1 verts).
 */
export function tubeIncompleteRingStroke(
  mesh: MeshModel,
  id: string,
  ring: number,
  sides: number,
  omitSide: number,
): CutStroke {
  const chain: Vec3[] = [];
  for (let k = 1; k < sides; k++) {
    const side = (omitSide + k) % sides;
    chain.push(readVertex(mesh, tubeVertex(ring, side, sides)));
  }
  return { id, points: chain };
}

/**
 * Branched mesh: open torso tube with an arm welded to the top open ring
 * (manifold join — end-ring edges go from boundary → 2 incidents).
 *
 * Face layout: torso bands 0..(torsoRings-2), then arm bands.
 * Seed on the arm distal of a bracelet at arm ring 1 must not flood torso.
 */
export type BranchedTube = {
  mesh: MeshModel;
  sides: number;
  torsoBands: number;
  armBands: number;
  armFaceStart: number;
  torsoVert: (ring: number, side: number) => number;
  /** armRing 0 = shared top torso ring; 1.. = new verts. */
  armVert: (armRing: number, side: number) => number;
  torsoBandFaces: (band: number) => FaceIndex[];
  armBandFaces: (band: number) => FaceIndex[];
};

export function branchedTube(sides = 4, armRings = 3): BranchedTube {
  const torsoRings = 5;
  const torsoBands = torsoRings - 1;
  const armBands = armRings - 1;
  const joinRing = torsoRings - 1;

  const verts: number[] = [];
  for (let r = 0; r < torsoRings; r++) {
    for (let s = 0; s < sides; s++) {
      const a = (2 * Math.PI * s) / sides;
      verts.push(Math.cos(a), r, Math.sin(a));
    }
  }
  for (let ar = 1; ar < armRings; ar++) {
    for (let s = 0; s < sides; s++) {
      const a = (2 * Math.PI * s) / sides;
      verts.push(1 + ar, joinRing + 0.2 * Math.cos(a), Math.sin(a));
    }
  }

  const faces: number[] = [];
  const torsoVert = (ring: number, side: number) => ring * sides + side;
  const armVert = (armRing: number, side: number) => {
    if (armRing === 0) return torsoVert(joinRing, side);
    return torsoRings * sides + (armRing - 1) * sides + side;
  };

  for (let r = 0; r < torsoBands; r++) {
    for (let s = 0; s < sides; s++) {
      const s2 = (s + 1) % sides;
      const a = torsoVert(r, s);
      const b = torsoVert(r, s2);
      const c = torsoVert(r + 1, s2);
      const d = torsoVert(r + 1, s);
      faces.push(a, b, c, a, c, d);
    }
  }
  const armFaceStart = faces.length / 3;
  for (let ar = 0; ar < armBands; ar++) {
    for (let s = 0; s < sides; s++) {
      const s2 = (s + 1) % sides;
      const a = armVert(ar, s);
      const b = armVert(ar, s2);
      const c = armVert(ar + 1, s2);
      const d = armVert(ar + 1, s);
      faces.push(a, b, c, a, c, d);
    }
  }

  const mesh = makeMesh(verts, faces);
  return {
    mesh,
    sides,
    torsoBands,
    armBands,
    armFaceStart,
    torsoVert,
    armVert,
    torsoBandFaces: (band: number) => tubeBandFaces(band, sides),
    armBandFaces: (band: number) => {
      const start = armFaceStart + band * sides * 2;
      const out: FaceIndex[] = [];
      for (let i = 0; i < sides * 2; i++) out.push(start + i);
      return out;
    },
  };
}

/** Circumferential loop on the arm at arm vertex ring `armRing` (≥ 1). */
export function branchedArmRingLoop(
  branched: BranchedTube,
  armRing: number,
): Set<EdgeKey> {
  const keys = new Set<EdgeKey>();
  const { sides, armVert } = branched;
  for (let s = 0; s < sides; s++) {
    keys.add(
      makeEdgeKey(armVert(armRing, s), armVert(armRing, (s + 1) % sides)),
    );
  }
  return keys;
}

/** Stroke along arm vertex ring `armRing` (canonical arm bracelet). */
export function branchedArmRingStroke(
  branched: BranchedTube,
  id: string,
  armRing: number,
): CutStroke {
  const { mesh, sides, armVert } = branched;
  const points: Vec3[] = [];
  for (let s = 0; s <= sides; s++) {
    points.push(readVertex(mesh, armVert(armRing, s % sides)));
  }
  return { id, points };
}

/**
 * Three triangles sharing one edge (non-manifold): verts 0-1 shared,
 * third verts 2, 3, 4.
 */
export function nonManifoldTripleEdge(): MeshModel {
  return makeMesh(
    [
      0, 0, 0, // 0
      1, 0, 0, // 1
      0.5, 1, 0, // 2
      0.5, -1, 0, // 3
      0.5, 0, 1, // 4
    ],
    [0, 1, 2, 0, 1, 3, 0, 1, 4],
  );
}
