import { describe, expect, it } from "vitest";
import { parseObj } from "../../io/obj/parseObj";
import { buildTopology } from "../../mesh/buildTopology";
import { makeEdgeKey } from "../../mesh/edgeKey";
import { createSeamRegistry, toggleSeam } from "../../seams/seamRegistry";
import { unfoldMesh } from "../../unfold/unfoldMesh";
import { buildTier1PreviewContent } from "./tier1Preview";

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

describe("buildTier1PreviewContent", () => {
  it("emits one polygon per face and seam lines when requested", () => {
    const result = seamTopFaceFromCube();
    const { innerSvg, stats } = buildTier1PreviewContent(result, true);

    expect(stats.facePolygonCount).toBe(12);
    expect(stats.seamLineCount).toBe(8);
    expect(innerSvg.match(/<polygon /g)?.length).toBe(12);
    expect(innerSvg.match(/<line /g)?.length).toBe(8);
    expect(innerSvg).toContain('id="faces"');
    expect(innerSvg).toContain('id="seams"');
  });

  it("omits seam lines when includeSeams is false", () => {
    const result = seamTopFaceFromCube();
    const { innerSvg, stats } = buildTier1PreviewContent(result, false);

    expect(stats.seamLineCount).toBe(0);
    expect(innerSvg).not.toContain("<line ");
    expect(innerSvg).toContain('id="seams"');
  });
});
