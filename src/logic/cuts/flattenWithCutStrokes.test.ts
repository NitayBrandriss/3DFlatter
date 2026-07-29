import { describe, expect, it } from "vitest";
import { parseObj } from "../io/obj/parseObj";
import { buildTopology } from "../mesh/buildTopology";
import { createSeamRegistry } from "../seams/seamRegistry";
import { flattenWithCutStrokes } from "./flattenWithCutStrokes";
import type { CutStroke, Vec3 } from "./types";

const TRI_OBJ = `
v 0 0 0
v 1 0 0
v 0 1 0
f 1 2 3
`;

function v(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

function stroke(id: string, points: Vec3[]): CutStroke {
  return { id, points };
}

describe("flattenWithCutStrokes", () => {
  it("unfolds the base mesh when there are no strokes", () => {
    const { mesh } = parseObj(TRI_OBJ);
    const topology = buildTopology(mesh);
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
  });

  it("materializes a diagonal cut then unfolds without error", () => {
    const { mesh } = parseObj(TRI_OBJ);
    const topology = buildTopology(mesh);
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

  it("surfaces open-loop warnings from materialize", () => {
    const { mesh } = parseObj(TRI_OBJ);
    const topology = buildTopology(mesh);
    // Interior chord endpoints on a closed triangle (no free boundary).
    const cuts = [stroke("open", [v(0.2, 0.2, 0), v(0.4, 0.2, 0)])];

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
