import { describe, expect, it } from "vitest";
import { buildTopology } from "../../mesh/buildTopology";
import { partitionIslands } from "../../mesh/partitionIslands";
import { summarizeTopology } from "../../mesh/topologyStats";
import { createSeamRegistry } from "../../seams/seamRegistry";
import { parseStl, StlParseError } from "./parseStl";
import {
  asciiUnitCubeStl,
  binaryUnitCubeStl,
  binaryUnitCubeStlWithSolidHeader,
  buildAsciiStl,
  buildBinaryStl,
  UNIT_CUBE_TRIANGLES,
  unweldedIcosahedronTriangles,
} from "./testMeshes";

function encodeText(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

describe("parseStl", () => {
  it("parses ASCII unit cube to 8 verts and 12 tris", () => {
    const { mesh, warnings } = parseStl(encodeText(asciiUnitCubeStl()));
    expect(warnings).toHaveLength(0);
    expect(mesh).toMatchObject({ vertexCount: 8, faceCount: 12 });
  });

  it("parses binary unit cube to the same counts as ASCII", () => {
    const { mesh, warnings } = parseStl(binaryUnitCubeStl());
    expect(warnings).toHaveLength(0);
    expect(mesh).toMatchObject({ vertexCount: 8, faceCount: 12 });
  });

  it("produces equivalent welded geometry from ASCII and binary cube", () => {
    const ascii = parseStl(encodeText(asciiUnitCubeStl())).mesh;
    const binary = parseStl(binaryUnitCubeStl()).mesh;

    expect(binary.vertexCount).toBe(ascii.vertexCount);
    expect(binary.faceCount).toBe(ascii.faceCount);

    for (let vi = 0; vi < ascii.vertexCount; vi++) {
      const ab = 3 * vi;
      expect(binary.vertices[ab]).toBeCloseTo(ascii.vertices[ab]!, 5);
      expect(binary.vertices[ab + 1]).toBeCloseTo(ascii.vertices[ab + 1]!, 5);
      expect(binary.vertices[ab + 2]).toBeCloseTo(ascii.vertices[ab + 2]!, 5);
    }
  });

  it("welds triangle soup so a closed icosahedron is one island", () => {
    const tris = unweldedIcosahedronTriangles();
    const { mesh, warnings } = parseStl(buildBinaryStl(tris));
    expect(warnings).toHaveLength(0);
    expect(mesh).toMatchObject({ vertexCount: 12, faceCount: 20 });

    const topo = buildTopology(mesh);
    expect(summarizeTopology(topo).boundaryEdgesCount).toBe(0);

    const islands = partitionIslands(mesh, topo, createSeamRegistry());
    expect(islands).toHaveLength(1);
    expect(islands[0]).toHaveLength(20);
  });

  it("builds closed manifold topology for unit cube", () => {
    const { mesh } = parseStl(binaryUnitCubeStl());
    const topo = buildTopology(mesh);
    expect(summarizeTopology(topo).boundaryEdgesCount).toBe(0);
    expect(topo.skippedDegenerateFaceCount).toBe(0);
  });

  it("detects binary STL when header starts with solid", () => {
    const { mesh } = parseStl(binaryUnitCubeStlWithSolidHeader());
    expect(mesh).toMatchObject({ vertexCount: 8, faceCount: 12 });
  });

  it("warns on geometrically degenerate triangle (coincident vertices)", () => {
    const stl = buildAsciiStl("degenerate", [[[0, 0, 0], [0, 0, 0], [0, 0, 0]]]);
    const { warnings } = parseStl(encodeText(stl));
    expect(warnings).toEqual([{ kind: "degenerate_triangle", triangleIndex: 0 }]);
  });

  it("skips collapsed triangles after welding in topology", () => {
    const stl = buildAsciiStl("degenerate", [
      [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
      ...UNIT_CUBE_TRIANGLES,
    ]);
    const { mesh, warnings } = parseStl(encodeText(stl));
    expect(warnings).toEqual([{ kind: "degenerate_triangle", triangleIndex: 0 }]);
    const topo = buildTopology(mesh);
    expect(topo.skippedDegenerateFaceCount).toBe(1);
    expect(mesh.faceCount).toBe(13);
  });

  it("parses binary STL with trailing padding bytes", () => {
    const full = binaryUnitCubeStl();
    const padded = new ArrayBuffer(full.byteLength + 128);
    new Uint8Array(padded).set(new Uint8Array(full));
    const { mesh, warnings } = parseStl(padded);
    expect(warnings).toHaveLength(0);
    expect(mesh).toMatchObject({ vertexCount: 8, faceCount: 12 });
  });

  it("throws on truncated binary STL", () => {
    const full = binaryUnitCubeStl();
    const truncated = full.slice(0, full.byteLength - 50);
    expect(() => parseStl(truncated)).toThrow(StlParseError);
  });

  it("throws on empty buffer", () => {
    expect(() => parseStl(new ArrayBuffer(0))).toThrow(StlParseError);
  });

  it("throws on binary STL with zero triangles", () => {
    const buffer = new ArrayBuffer(84);
    const view = new DataView(buffer);
    view.setUint32(80, 0, true);
    expect(() => parseStl(buffer)).toThrow(/no triangles/i);
  });

  it("throws on NaN vertex in binary STL", () => {
    const buffer = buildBinaryStl([[[0, 0, 0], [1, 0, 0], [0, 1, 0]]]);
    const view = new DataView(buffer);
    view.setFloat32(84 + 12, Number.NaN, true);
    expect(() => parseStl(buffer)).toThrow(/non-finite/i);
  });

  it("throws on ASCII facet with wrong vertex count", () => {
    const stl = `
solid bad
  facet normal 0 0 1
    outer loop
      vertex 0 0 0
      vertex 1 0 0
    endloop
  endfacet
endsolid bad
`;
    expect(() => parseStl(encodeText(stl))).toThrow(/exactly 3 vertices/i);
  });

  it("throws on unrecognized content", () => {
    const garbage = "not an stl file ".repeat(10);
    expect(() => parseStl(encodeText(garbage))).toThrow(/unrecognized/i);
  });
});
