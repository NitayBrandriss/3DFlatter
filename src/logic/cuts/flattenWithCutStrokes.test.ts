import { describe, expect, it } from "vitest";
import { buildTopology } from "../mesh/buildTopology";
import { makeEdgeKey } from "../mesh/edgeKey";
import { partitionIslands } from "../mesh/partitionIslands";
import type { UnfoldMeshResult } from "../mesh/types";
import {
  createSeamRegistry,
  toggleSeam,
} from "../seams/seamRegistry";
import { unfoldMesh } from "../unfold/unfoldMesh";
import { countQualityIssues } from "../unfold/qualitySummary";
import { assertUnfoldMeshSoupInvariants } from "../unfold/unfoldTestHelpers";
import { flattenWithCutStrokes } from "./flattenWithCutStrokes";
import { materializeCutStrokes } from "./materializeCutStrokes";
import {
  singleFaceClosedLoop,
  stroke,
  unitQuad,
  unitTriangle,
  v,
} from "./cutTestFixtures";

function triMesh() {
  const mesh = unitTriangle();
  return { mesh, topology: buildTopology(mesh) };
}

function islandFaceSets(result: UnfoldMeshResult): string[] {
  return result.islands
    .map((isl) => [...isl.faces].sort((a, b) => a - b).join(","))
    .sort();
}

function unfoldedFaceCount(result: UnfoldMeshResult): number {
  return result.islands.reduce((n, isl) => n + isl.faces.length, 0);
}

describe("flattenWithCutStrokes", () => {
  it("empty strokes matches direct unfoldMesh island count and face sets", () => {
    const { mesh, topology } = triMesh();
    const seams = createSeamRegistry();

    const viaFlatten = flattenWithCutStrokes({
      mesh,
      topology,
      seams,
      cutStrokes: [],
    });
    const viaUnfold = unfoldMesh(mesh, topology, seams);

    expect(viaFlatten.materializeWarnings).toEqual([]);
    expect(viaFlatten.openLoops).toEqual([]);
    expect(viaFlatten.unfold.error).toBeUndefined();
    expect(viaFlatten.unfold.islands.length).toBe(viaUnfold.islands.length);
    expect(islandFaceSets(viaFlatten.unfold)).toEqual(islandFaceSets(viaUnfold));
    assertUnfoldMeshSoupInvariants(viaFlatten.unfold, mesh);
  });

  it("does not mutate the base mesh when strokes are present or empty", () => {
    const { mesh, topology } = triMesh();
    const vertsBefore = Array.from(mesh.vertices);
    const facesBefore = Array.from(mesh.faces);

    flattenWithCutStrokes({
      mesh,
      topology,
      seams: createSeamRegistry(),
      cutStrokes: [stroke("d", [v(0.5, 0), v(0.5, 0.5)])],
    });
    expect(Array.from(mesh.vertices)).toEqual(vertsBefore);
    expect(Array.from(mesh.faces)).toEqual(facesBefore);

    flattenWithCutStrokes({
      mesh,
      topology,
      seams: createSeamRegistry(),
      cutStrokes: [],
    });
    expect(Array.from(mesh.vertices)).toEqual(vertsBefore);
  });

  it("diagonal cut increases derived face count vs base", () => {
    const { mesh, topology } = triMesh();
    const result = flattenWithCutStrokes({
      mesh,
      topology,
      seams: createSeamRegistry(),
      cutStrokes: [stroke("diag", [v(0, 0, 0), v(0.5, 0.5, 0)])],
    });

    expect(result.unfold.error).toBeUndefined();
    expect(unfoldedFaceCount(result.unfold)).toBeGreaterThan(mesh.faceCount);
  });

  it("unions manual seams into the unfolded pattern when cuts exist", () => {
    const { mesh, topology } = triMesh();
    const manual = toggleSeam(createSeamRegistry(), makeEdgeKey(0, 1));
    const result = flattenWithCutStrokes({
      mesh,
      topology,
      seams: manual,
      cutStrokes: [stroke("dart", [v(0.5, 0), v(0.25, 0.25)])],
    });
    expect(result.unfold.error).toBeUndefined();
    expect(unfoldedFaceCount(result.unfold)).toBeGreaterThan(mesh.faceCount);
  });

  it("skips self-intersecting stroke but still unfolds the base-derived mesh", () => {
    const { mesh, topology } = triMesh();
    const baseline = flattenWithCutStrokes({
      mesh,
      topology,
      seams: createSeamRegistry(),
      cutStrokes: [],
    });
    const result = flattenWithCutStrokes({
      mesh,
      topology,
      seams: createSeamRegistry(),
      cutStrokes: [
        stroke("x", [
          v(0.2, 0.05),
          v(0.6, 0.35),
          v(0.55, 0.05),
          v(0.15, 0.35),
        ]),
      ],
    });
    expect(
      result.materializeWarnings.some((w) => w.includes("self-intersecting")),
    ).toBe(true);
    expect(result.unfold.error).toBeUndefined();
    expect(result.unfold.islands.length).toBe(baseline.unfold.islands.length);
  });

  it("multi-stroke order is applied (second stroke sees first subdivision)", () => {
    const mesh = unitQuad();
    const topology = buildTopology(mesh);
    const s1 = stroke("a", [v(0, 0.5), v(0.5, 0.5)]);
    const s2 = stroke("b", [v(0.5, 0.5), v(1, 0.5)]);
    const both = flattenWithCutStrokes({
      mesh,
      topology,
      seams: createSeamRegistry(),
      cutStrokes: [s1, s2],
    });
    const one = flattenWithCutStrokes({
      mesh,
      topology,
      seams: createSeamRegistry(),
      cutStrokes: [s1],
    });
    expect(both.unfold.error).toBeUndefined();
    expect(one.unfold.error).toBeUndefined();
    expect(unfoldedFaceCount(both.unfold)).toBeGreaterThanOrEqual(
      unfoldedFaceCount(one.unfold),
    );
  });

  it("open dart on triangle warns and does not split islands", () => {
    const { mesh, topology } = triMesh();
    const baseline = flattenWithCutStrokes({
      mesh,
      topology,
      seams: createSeamRegistry(),
      cutStrokes: [],
    });
    const result = flattenWithCutStrokes({
      mesh,
      topology,
      seams: createSeamRegistry(),
      cutStrokes: [stroke("open", [v(0.5, 0), v(0.25, 0.25)])],
    });

    expect(result.openLoops.length).toBeGreaterThanOrEqual(1);
    expect(result.materializeWarnings.some((w) => w.includes("open loop"))).toBe(
      true,
    );
    expect(result.unfold.error).toBeUndefined();
    expect(result.unfold.islands.length).toBe(baseline.unfold.islands.length);
  });

  it("single-face closed loop on unitQuad splits islands with ADR 0002 soup", () => {
    const mesh = unitQuad();
    const topology = buildTopology(mesh);
    const cuts = [singleFaceClosedLoop()];
    const result = flattenWithCutStrokes({
      mesh,
      topology,
      seams: createSeamRegistry(),
      cutStrokes: cuts,
    });

    expect(result.unfold.error).toBeUndefined();
    expect(result.openLoops).toEqual([]);
    expect(result.unfold.islands.length).toBeGreaterThanOrEqual(2);
    expect(countQualityIssues(result.unfold).collisionCount).toBe(0);

    const derived = materializeCutStrokes(mesh, cuts, new Set());
    expect(partitionIslands(derived.mesh, derived.topology, derived.seams).length)
      .toBeGreaterThanOrEqual(2);
    assertUnfoldMeshSoupInvariants(result.unfold, derived.mesh);
  });
});
