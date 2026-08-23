import { describe, expect, it } from "vitest";
import { buildTopology } from "../../mesh/buildTopology";
import { partitionIslands } from "../../mesh/partitionIslands";
import { summarizeTopology } from "../../mesh/topologyStats";
import { createSeamRegistry } from "../../seams/seamRegistry";
import { MAX_MESH_TRIANGLES } from "../loadBudgets";
import { parseObj, ObjParseError } from "./parseObj";
import { unweldedIcosahedronObj } from "./testMeshes";

describe("parseObj", () => {
  it("welds per-face vertices so a closed icosahedron is one island", () => {
    const { mesh, warnings } = parseObj(unweldedIcosahedronObj());
    expect(warnings).toHaveLength(0);
    expect(mesh).toMatchObject({ vertexCount: 12, faceCount: 20 });

    const topo = buildTopology(mesh);
    expect(summarizeTopology(topo).boundaryEdgesCount).toBe(0);

    const islands = partitionIslands(mesh, topo, createSeamRegistry());
    expect(islands).toHaveLength(1);
    expect(islands[0]).toHaveLength(20);
  });

  it("warns on a concave quad but still fan-triangulates", () => {
    const obj = `
v 0 0 0
v 4 0 0
v 1 1 0
v 0 4 0
f 1 2 3 4
`;
    const { mesh, warnings } = parseObj(obj);
    expect(warnings).toEqual([
      { kind: "concave_ngon", line: 6, vertexCount: 4 },
    ]);
    expect(mesh.faceCount).toBe(2);
  });

  it("does not warn on a convex quad", () => {
    const obj = `
v 0 0 0
v 2 0 0
v 2 2 0
v 0 2 0
f 1 2 3 4
`;
    const { mesh, warnings } = parseObj(obj);
    expect(warnings).toHaveLength(0);
    expect(mesh.faceCount).toBe(2);
  });

  it("rejects face index tokens that are not full integers", () => {
    const obj = `
v 0 0 0
v 1 0 0
v 0 1 0
f 1 2 12abc
`;
    expect(() => parseObj(obj)).toThrow(ObjParseError);
    expect(() => parseObj(obj)).toThrow(/Invalid face index token/);
  });

  it("rejects an empty file", () => {
    expect(() => parseObj("")).toThrow(ObjParseError);
    expect(() => parseObj("")).toThrow(/No vertices found/);
  });

  it("rejects vertices with no faces", () => {
    const obj = `
v 0 0 0
v 1 0 0
v 0 1 0
`;
    expect(() => parseObj(obj)).toThrow(ObjParseError);
    expect(() => parseObj(obj)).toThrow(/No faces found/);
  });

  it("rejects a face defined before any vertices", () => {
    const obj = `
f 1 2 3
v 0 0 0
v 1 0 0
v 0 1 0
`;
    expect(() => parseObj(obj)).toThrow(ObjParseError);
    expect(() => parseObj(obj)).toThrow(/Face defined before any vertices/);
  });

  it("rejects an out-of-range face vertex index", () => {
    const obj = `
v 0 0 0
v 1 0 0
v 0 1 0
f 1 2 99
`;
    expect(() => parseObj(obj)).toThrow(ObjParseError);
    expect(() => parseObj(obj)).toThrow(/out-of-range vertex/);
  });

  it("rejects non-finite vertex coordinates", () => {
    const nanObj = `
v 0 NaN 0
v 1 0 0
v 0 1 0
f 1 2 3
`;
    expect(() => parseObj(nanObj)).toThrow(ObjParseError);
    expect(() => parseObj(nanObj)).toThrow(/Invalid vertex coordinates/);

    const infObj = `
v 0 0 Infinity
v 1 0 0
v 0 1 0
f 1 2 3
`;
    expect(() => parseObj(infObj)).toThrow(ObjParseError);
    expect(() => parseObj(infObj)).toThrow(/Invalid vertex coordinates/);
  });

  it("rejects when triangulated face count exceeds the soft limit", () => {
    const obj = `v 0 0 0\nv 1 0 0\nv 0 1 0\n${"f 1 2 3\n".repeat(MAX_MESH_TRIANGLES + 1)}`;
    try {
      parseObj(obj);
      expect.fail("expected ObjParseError");
    } catch (error) {
      expect(error).toBeInstanceOf(ObjParseError);
      expect((error as Error).message).toMatch(/too many triangles/i);
    }
  });
});
