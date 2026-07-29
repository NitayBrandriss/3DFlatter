import { describe, expect, it } from "vitest";
import { parseObj } from "../io/obj/parseObj";
import { buildTopology } from "../mesh/buildTopology";
import { makeEdgeKey } from "../mesh/edgeKey";
import {
  createSeamRegistry,
  toggleSeam,
} from "../seams/seamRegistry";
import { flattenWithCutStrokes } from "./flattenWithCutStrokes";
import type { CutStroke, Vec3 } from "./types";

const TRI_OBJ = `
v 0 0 0
v 1 0 0
v 0 1 0
f 1 2 3
`;

function v(x: number, y: number, z = 0): Vec3 {
  return { x, y, z };
}

function stroke(id: string, points: Vec3[]): CutStroke {
  return { id, points };
}

function triMesh() {
  const { mesh } = parseObj(TRI_OBJ);
  return { mesh, topology: buildTopology(mesh) };
}

describe("flattenWithCutStrokes", () => {
  it("unfolds the base mesh when there are no strokes", () => {
    const { mesh, topology } = triMesh();
    const seams = createSeamRegistry();

    const result = flattenWithCutStrokes({
      mesh,
      topology,
      seams,
      cutStrokes: [],
    });

    expect(result.materializeWarnings).toEqual([]);
    expect(result.openLoops).toEqual([]);
    expect(result.unfold.error).toBeUndefined();
    expect(result.unfold.islands.length).toBe(1);
    expect(result.unfold.islands[0]!.faces.length).toBe(1);
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

  it("materializes a diagonal cut then unfolds without error", () => {
    const { mesh, topology } = triMesh();
    const seams = createSeamRegistry();
    const cuts = [stroke("diag", [v(0, 0, 0), v(0.5, 0.5, 0)])];

    const result = flattenWithCutStrokes({
      mesh,
      topology,
      seams,
      cutStrokes: cuts,
    });

    expect(result.unfold.error).toBeUndefined();
    expect(result.unfold.islands.length).toBeGreaterThanOrEqual(1);
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
    expect(result.unfold.islands.length).toBeGreaterThanOrEqual(1);
  });

  it("skips self-intersecting stroke but still unfolds the base-derived mesh", () => {
    const { mesh, topology } = triMesh();
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
    expect(result.unfold.islands.length).toBeGreaterThanOrEqual(1);
  });

  it("multi-stroke order is applied (second stroke sees first subdivision)", () => {
    const { mesh } = parseObj(`
v 0 0 0
v 1 0 0
v 1 1 0
v 0 1 0
f 1 2 3
f 1 3 4
`);
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
    const facesBoth = both.unfold.islands.reduce(
      (n, isl) => n + isl.faces.length,
      0,
    );
    const facesOne = one.unfold.islands.reduce(
      (n, isl) => n + isl.faces.length,
      0,
    );
    expect(facesBoth).toBeGreaterThanOrEqual(facesOne);
  });

  it("surfaces open-loop warnings and propagates openLoops", () => {
    const { mesh, topology } = triMesh();
    const cuts = [stroke("open", [v(0.2, 0.2), v(0.4, 0.2)])];

    const result = flattenWithCutStrokes({
      mesh,
      topology,
      seams: createSeamRegistry(),
      cutStrokes: cuts,
    });

    expect(result.openLoops.length).toBeGreaterThan(0);
    expect(result.materializeWarnings.some((w) => w.includes("open loop"))).toBe(
      true,
    );
    expect(result.unfold.error).toBeUndefined();
  });
});
