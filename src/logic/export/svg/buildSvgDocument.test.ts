import { describe, expect, it } from "vitest";
import { parseObj } from "../../io/obj/parseObj";
import { buildTopology } from "../../mesh/buildTopology";
import { makeEdgeKey } from "../../mesh/edgeKey";
import { createSeamRegistry, toggleSeam } from "../../seams/seamRegistry";
import { unfoldMesh } from "../../unfold/unfoldMesh";
import { buildSvgDocument, SvgExportError } from "./buildSvgDocument";
import { computeSvgViewBox } from "./viewBox";
import { yFlipGroupTransform } from "./yFlip";

const CUBE_OBJ = `
v -1 -1 -1
v 1 -1 -1
v 1 1 -1
v -1 1 -1
v -1 -1 1
v 1 -1 1
v 1 1 1
v -1 1 1
f 1 2 3
f 1 3 4
f 5 6 7
f 5 7 8
f 1 5 8
f 1 8 4
f 2 6 7
f 2 7 3
f 4 3 7
f 4 7 8
f 1 2 6
f 1 6 5
`;

function seamTopFaceFromCube() {
  const { mesh } = parseObj(CUBE_OBJ);
  const topo = buildTopology(mesh);
  let seams = createSeamRegistry();
  for (const key of [
    makeEdgeKey(4, 5),
    makeEdgeKey(5, 6),
    makeEdgeKey(6, 7),
    makeEdgeKey(4, 7),
  ]) {
    seams = toggleSeam(seams, key);
  }
  return unfoldMesh(mesh, topo, seams);
}

describe("buildSvgDocument", () => {
  it("builds a well-formed preview SVG for a seamed cube", () => {
    const result = seamTopFaceFromCube();
    const built = buildSvgDocument(result, { tier: "preview", title: "Cube pattern" });

    expect(built.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(built.svg).toContain("<title>Cube pattern</title>");
    expect(built.stats.facePolygonCount).toBe(12);
    expect(built.stats.seamLineCount).toBe(8);
    expect(built.svg.match(/<polygon /g)?.length).toBe(12);
    expect(built.svg.match(/<line /g)?.length).toBe(8);

    const expectedViewBox = computeSvgViewBox(result.bounds);
    expect(built.viewBox.x).toBeCloseTo(expectedViewBox.x);
    expect(built.viewBox.y).toBeCloseTo(expectedViewBox.y);
    expect(built.viewBox.width).toBeCloseTo(expectedViewBox.width);
    expect(built.viewBox.height).toBeCloseTo(expectedViewBox.height);
  });

  it("embeds the Y-flip transform matching layout bounds", () => {
    const result = seamTopFaceFromCube();
    const built = buildSvgDocument(result, { tier: "preview" });
    const { minY, maxY } = result.bounds;
    const flip = yFlipGroupTransform(minY, maxY);

    expect(built.svg).toContain(`transform="${flip}"`);
  });

  it("omits seam lines when includeSeams is false", () => {
    const result = seamTopFaceFromCube();
    const built = buildSvgDocument(result, { tier: "preview", includeSeams: false });

    expect(built.stats.seamLineCount).toBe(0);
    expect(built.svg).not.toContain("<line ");
  });

  it("throws on error results", () => {
    expect(() =>
      buildSvgDocument(
        {
          islands: [],
          bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
          seamSegments: [],
          error: "unfold failed",
        },
        { tier: "preview" },
      ),
    ).toThrow(SvgExportError);
  });

  it("throws on empty islands", () => {
    expect(() =>
      buildSvgDocument(
        {
          islands: [],
          bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
          seamSegments: [],
        },
        { tier: "preview" },
      ),
    ).toThrow(SvgExportError);
  });

  it("rejects manufacturing tier until implemented", () => {
    const result = seamTopFaceFromCube();
    expect(() => buildSvgDocument(result, { tier: "manufacturing" })).toThrow(
      SvgExportError,
    );
  });
});
