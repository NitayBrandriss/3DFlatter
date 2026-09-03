import { describe, expect, it } from "vitest";
import { singleFaceClosedLoop, stroke, unitQuad, v } from "../cuts/cutTestFixtures";
import { classifyStrokeVsMask, partitionStrokesVsMask } from "./classifyStrokeVsMask";
import { maskFromFaces } from "./faceMask";
import { openTube, tubeBandFaces, tubeBraceletStroke } from "./testMeshes";

describe("classifyStrokeVsMask", () => {
  it("classifies inside / outside / crossing on a unit quad", () => {
    const mesh = unitQuad();
    const mask = maskFromFaces(mesh.faceCount, [0]);

    expect(classifyStrokeVsMask(mesh, singleFaceClosedLoop(), mask)).toBe(
      "inside",
    );

    const onFace1 = stroke("out", [v(0.15, 0.7), v(0.2, 0.8), v(0.1, 0.75)]);
    expect(classifyStrokeVsMask(mesh, onFace1, mask)).toBe("outside");

    const crossing = stroke("cross", [v(0.7, 0.2), v(0.2, 0.7)]);
    expect(classifyStrokeVsMask(mesh, crossing, mask)).toBe("crossing");
  });

  it("partitionStrokesVsMask routes crossing strokes to skip", () => {
    const mesh = unitQuad();
    const mask = maskFromFaces(mesh.faceCount, [0]);
    const insideStroke = singleFaceClosedLoop();
    const outsideStroke = stroke("out", [v(0.15, 0.7), v(0.2, 0.8)]);
    const crossingStroke = stroke("cross", [v(0.7, 0.2), v(0.2, 0.7)]);

    const parts = partitionStrokesVsMask(
      mesh,
      [insideStroke, outsideStroke, crossingStroke],
      mask,
    );
    expect(parts.inside.map((s) => s.id)).toEqual([insideStroke.id]);
    expect(parts.outside.map((s) => s.id)).toEqual(["out"]);
    expect(parts.crossing.map((s) => s.id)).toEqual(["cross"]);
  });

  it("a bracelet on the isolation wall is crossing; a stroke in the band is inside", () => {
    const sides = 6;
    const mesh = openTube(5, sides);
    const keep = [...tubeBandFaces(1, sides), ...tubeBandFaces(2, sides)];
    const mask = maskFromFaces(mesh.faceCount, keep);

    const insideBand = tubeBraceletStroke(mesh, "arm", 1, sides);
    expect(classifyStrokeVsMask(mesh, insideBand, mask)).toBe("inside");

    const ghost = tubeBraceletStroke(mesh, "torso", 3, sides);
    expect(classifyStrokeVsMask(mesh, ghost, mask)).toBe("outside");

    // Wrist loop sits on band 0; incident faces of ring-1 edges may also
    // include band 1, so the relation is outside or crossing — never inside.
    const wall = tubeBraceletStroke(mesh, "wrist", 0, sides);
    expect(classifyStrokeVsMask(mesh, wall, mask)).not.toBe("inside");
  });
});
