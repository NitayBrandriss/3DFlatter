import { describe, expect, it } from "vitest";
import { partitionStrokesVsMask } from "../isolation/classifyStrokeVsMask";
import {
  assertSubsetHasFaces,
  extractFaceSubset,
} from "../isolation/extractFaceSubset";
import { createFaceMask, maskFromFaces } from "../isolation/faceMask";
import {
  branchedTube,
  nonManifoldTripleEdge,
  openTube,
  tubeBandFaces,
  tubeBraceletStroke,
  tubeVertex,
} from "../isolation/testMeshes";
import type { FaceMask } from "../isolation/types";
import { buildTopology } from "../mesh/buildTopology";
import { makeEdgeKey } from "../mesh/edgeKey";
import type { EdgeKey, MeshModel, SeamRegistry, UnfoldMeshResult } from "../mesh/types";
import { createSeamRegistry, toggleSeam } from "../seams/seamRegistry";
import { unfoldMesh } from "../unfold/unfoldMesh";
import { stroke } from "./cutTestFixtures";
import { flattenWithCutStrokes } from "./flattenWithCutStrokes";
import { materializeCutStrokes } from "./materializeCutStrokes";
import type { Vec3 } from "./types";

const SIDES = 4;

function unfoldedFaceCount(result: UnfoldMeshResult): number {
  return result.islands.reduce((n, island) => n + island.faces.length, 0);
}

function faceVerts(mesh: MeshModel, faceId: number): [number, number, number] {
  const base = faceId * 3;
  return [mesh.faces[base]!, mesh.faces[base + 1]!, mesh.faces[base + 2]!];
}

function snapshotBuffers(mesh: MeshModel): { vertices: number[]; faces: number[] } {
  return {
    vertices: Array.from(mesh.vertices),
    faces: Array.from(mesh.faces),
  };
}

function expectSessionUnchanged(
  mesh: MeshModel,
  before: { vertices: number[]; faces: number[] },
): void {
  expect(Array.from(mesh.vertices)).toEqual(before.vertices);
  expect(Array.from(mesh.faces)).toEqual(before.faces);
}

function maskedIncidentCount(
  mesh: MeshModel,
  key: EdgeKey,
  mask: FaceMask,
): number {
  const incidents = buildTopology(mesh).edgeToFaces.get(key);
  if (!incidents) return 0;
  let n = 0;
  for (const incident of incidents) {
    if (mask[incident.faceId] === 1) n++;
  }
  return n;
}

function longitudinalMidpoint(
  mesh: MeshModel,
  band: number,
  side: number,
  sides: number,
): Vec3 {
  const a = tubeVertex(band, side, sides);
  const b = tubeVertex(band + 1, side, sides);
  return {
    x: (mesh.vertices[3 * a]! + mesh.vertices[3 * b]!) / 2,
    y: (mesh.vertices[3 * a + 1]! + mesh.vertices[3 * b + 1]!) / 2,
    z: (mesh.vertices[3 * a + 2]! + mesh.vertices[3 * b + 2]!) / 2,
  };
}

function seamRegistry(keys: EdgeKey[]): SeamRegistry {
  let registry = createSeamRegistry();
  for (const key of keys) registry = toggleSeam(registry, key);
  return registry;
}

describe("flattenWithCutStrokes isolation", () => {
  it("keeps seams with a masked incident and drops ghost seams", () => {
    const mesh = openTube(5, SIDES);
    const before = snapshotBuffers(mesh);
    const keep = [...tubeBandFaces(1, SIDES), ...tubeBandFaces(2, SIDES)];
    const mask = maskFromFaces(mesh.faceCount, keep);
    const boundary = makeEdgeKey(tubeVertex(1, 0, SIDES), tubeVertex(1, 1, SIDES));
    const interior = makeEdgeKey(tubeVertex(1, 0, SIDES), tubeVertex(2, 1, SIDES));
    const ghost = makeEdgeKey(tubeVertex(3, 0, SIDES), tubeVertex(4, 1, SIDES));
    expect(boundary).toBe("4,5");
    expect(interior).toBe("4,9");
    expect(ghost).toBe("12,17");
    expect(maskedIncidentCount(mesh, boundary, mask)).toBe(1);
    expect(maskedIncidentCount(mesh, interior, mask)).toBe(2);
    expect(buildTopology(mesh).edgeToFaces.get(ghost)?.length).toBeGreaterThan(0);
    expect(maskedIncidentCount(mesh, ghost, mask)).toBe(0);

    const seams = seamRegistry([boundary, interior, ghost]);
    const result = flattenWithCutStrokes({
      mesh,
      topology: buildTopology(mesh),
      seams,
      cutStrokes: [],
      isolation: { active: true, mask },
    });

    expect(result.appliedSeams).toEqual(new Set([boundary, interior]));
    expect(result.appliedSeams.has(ghost)).toBe(false);
    expectSessionUnchanged(mesh, before);
  });

  it("materializes inside strokes and skips outside and crossing in input order", () => {
    const mesh = openTube(5, SIDES);
    const before = snapshotBuffers(mesh);
    const keep = [...tubeBandFaces(1, SIDES), ...tubeBandFaces(2, SIDES)];
    const mask = maskFromFaces(mesh.faceCount, keep);
    const insideStroke = tubeBraceletStroke(mesh, "in", 1, SIDES);
    const ghostStroke = tubeBraceletStroke(mesh, "ghost", 3, SIDES);
    const crossStroke = stroke("cross", [
      longitudinalMidpoint(mesh, 1, 0, SIDES),
      longitudinalMidpoint(mesh, 3, 0, SIDES),
    ]);
    const strokes = [insideStroke, ghostStroke, crossStroke];
    const parts = partitionStrokesVsMask(mesh, strokes, mask);
    expect(parts.inside.map((s) => s.id)).toEqual(["in"]);
    expect(parts.outside.map((s) => s.id)).toEqual(["ghost"]);
    expect(parts.crossing.map((s) => s.id)).toEqual(["cross"]);

    const subset = extractFaceSubset(mesh, mask);
    assertSubsetHasFaces(subset);
    const insideOnly = materializeCutStrokes(
      subset,
      [insideStroke],
      createSeamRegistry(),
    );
    const insideUnfold = unfoldMesh(
      insideOnly.mesh,
      insideOnly.topology,
      insideOnly.seams,
    );
    const insideFaceCount = unfoldedFaceCount(insideUnfold);
    expect(insideFaceCount).toBeGreaterThan(keep.length);

    const result = flattenWithCutStrokes({
      mesh,
      topology: buildTopology(mesh),
      seams: createSeamRegistry(),
      cutStrokes: strokes,
      isolation: { active: true, mask },
    });

    expect(result.materializedStrokeIds).toEqual(["in"]);
    expect(result.skippedStrokes).toEqual([
      { id: "ghost", relation: "outside" },
      { id: "cross", relation: "crossing" },
    ]);
    expect(unfoldedFaceCount(result.unfold)).toBe(insideFaceCount);
    expect(unfoldedFaceCount(result.unfold)).toBeGreaterThan(keep.length);
    expectSessionUnchanged(mesh, before);
  });

  it("unfolds the masked subset when active and there are no strokes", () => {
    const mesh = openTube(5, SIDES);
    const before = snapshotBuffers(mesh);
    expect(mesh.faceCount).toBe(32);
    const keep = [...tubeBandFaces(1, SIDES), ...tubeBandFaces(2, SIDES)];
    expect(keep).toHaveLength(16);
    const mask = maskFromFaces(mesh.faceCount, keep);

    const result = flattenWithCutStrokes({
      mesh,
      topology: buildTopology(mesh),
      seams: createSeamRegistry(),
      cutStrokes: [],
      isolation: { active: true, mask },
    });

    expect(unfoldedFaceCount(result.unfold)).toBe(keep.length);
    expect(result.flattenMesh.faceCount).toBe(keep.length);
    for (const island of result.unfold.islands) {
      for (const faceId of island.faces) {
        expect(faceId).toBeLessThan(result.flattenMesh.faceCount);
      }
    }
    expect(result.flattenMesh.vertexCount).toBe(mesh.vertexCount);
    expect(Array.from(result.flattenMesh.vertices)).toEqual(Array.from(mesh.vertices));
    expect(faceVerts(result.flattenMesh, 0)).toEqual(faceVerts(mesh, keep[0]!));
    expectSessionUnchanged(mesh, before);
  });

  it("ignores a stored mask when isolation is inactive", () => {
    const mesh = openTube(5, SIDES);
    const before = snapshotBuffers(mesh);
    const keep = [...tubeBandFaces(1, SIDES), ...tubeBandFaces(2, SIDES)];
    const mask = maskFromFaces(mesh.faceCount, keep);
    const ghost = makeEdgeKey(tubeVertex(3, 0, SIDES), tubeVertex(4, 1, SIDES));
    expect(ghost).toBe("12,17");
    const seams = seamRegistry([ghost]);

    const result = flattenWithCutStrokes({
      mesh,
      topology: buildTopology(mesh),
      seams,
      cutStrokes: [],
      isolation: { active: false, mask },
    });

    expect(unfoldedFaceCount(result.unfold)).toBe(mesh.faceCount);
    expect(result.appliedSeams).toEqual(seams.seams);
    expect(result.appliedSeams.has(ghost)).toBe(true);
    expect(result.skippedStrokes).toEqual([]);
    expect(result.flattenMesh).toBe(mesh);
    expectSessionUnchanged(mesh, before);
  });

  it("does not leak a branched torso into an arm-band isolate", () => {
    const branched = branchedTube(4, 3);
    const mesh = branched.mesh;
    const before = snapshotBuffers(mesh);
    expect(mesh.faceCount).toBe(48);
    const keep = [...branched.armBandFaces(0), ...branched.armBandFaces(1)];
    expect(keep).toHaveLength(16);
    const mask = maskFromFaces(mesh.faceCount, keep);
    const distal = branched.armVert(2, 0);

    const result = flattenWithCutStrokes({
      mesh,
      topology: buildTopology(mesh),
      seams: createSeamRegistry(),
      cutStrokes: [],
      isolation: { active: true, mask },
    });

    expect(unfoldedFaceCount(result.unfold)).toBe(16);
    expect(result.flattenMesh.vertexCount).toBe(mesh.vertexCount);
    expect(Array.from(result.flattenMesh.vertices)).toEqual(Array.from(mesh.vertices));
    expect(Array.from(result.flattenMesh.faces)).toContain(distal);
    expectSessionUnchanged(mesh, before);
  });

  it("unfolds disjoint masked bands as two islands", () => {
    const mesh = openTube(5, SIDES);
    const before = snapshotBuffers(mesh);
    const keep = [...tubeBandFaces(1, SIDES), ...tubeBandFaces(3, SIDES)];
    expect(keep).toHaveLength(16);
    const mask = maskFromFaces(mesh.faceCount, keep);

    const result = flattenWithCutStrokes({
      mesh,
      topology: buildTopology(mesh),
      seams: createSeamRegistry(),
      cutStrokes: [],
      isolation: { active: true, mask },
    });

    expect(result.unfold.islands).toHaveLength(2);
    expect(result.flattenMesh.faceCount).toBe(16);
    expect(result.flattenMesh.vertexCount).toBe(mesh.vertexCount);
    expect(faceVerts(result.flattenMesh, 0)).toEqual(faceVerts(mesh, keep[0]!));
    expectSessionUnchanged(mesh, before);
  });

  it("throws the empty-subset guard before buildTopology", () => {
    const mesh = openTube(5, SIDES);
    const before = snapshotBuffers(mesh);
    const mask = createFaceMask(mesh.faceCount);
    const run = () =>
      flattenWithCutStrokes({
        mesh,
        topology: buildTopology(mesh),
        seams: createSeamRegistry(),
        cutStrokes: [],
        isolation: { active: true, mask },
      });

    expect(run).toThrow(/empty isolate subset/);
    expect(run).not.toThrow(/mesh has no faces/);
    expectSessionUnchanged(mesh, before);
  });

  it("keeps a non-manifold seam when one incident face remains", () => {
    const mesh = nonManifoldTripleEdge();
    const before = snapshotBuffers(mesh);
    const mask = maskFromFaces(mesh.faceCount, [0]);
    const seam = makeEdgeKey(0, 1);
    expect(seam).toBe("0,1");

    const result = flattenWithCutStrokes({
      mesh,
      topology: buildTopology(mesh),
      seams: seamRegistry([seam]),
      cutStrokes: [],
      isolation: { active: true, mask },
    });

    expect(result.appliedSeams.has(seam)).toBe(true);
    expect(result.flattenMesh.faceCount).toBe(1);
    expect(unfoldedFaceCount(result.unfold)).toBe(1);
    expectSessionUnchanged(mesh, before);
  });
});
