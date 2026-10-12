import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { maskFromFaces } from "../logic/isolation/faceMask";
import { splitIsolationIndexBuffers } from "../logic/isolation/maskGeometry";
import { makeMesh, openTube } from "../logic/isolation/testMeshes";
import * as displayNormalization from "./displayNormalization";
import { computeDisplayVertices } from "./displayNormalization";
import {
  buildActiveIsolationGeometries,
  ghostMeshRaycast,
} from "./meshModelToGeometry";

describe("buildActiveIsolationGeometries", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds both index buffers from one full-mesh normalization", () => {
    const mesh = openTube(2, 4);
    const mask = maskFromFaces(mesh.faceCount, [0, 1]);
    const split = splitIsolationIndexBuffers(mesh, mask);
    const spy = vi.spyOn(displayNormalization, "computeDisplayNormalization");

    const built = buildActiveIsolationGeometries(mesh, mask);

    expect(spy).toHaveBeenCalledTimes(1);
    const normalized = spy.mock.calls[0]?.[0];
    expect(normalized).toBeInstanceOf(Float32Array);
    expect(normalized!.length).toBe(mesh.vertices.length);
    expect(Array.from(normalized!)).toEqual(Array.from(mesh.vertices));

    const isolatePos = built.isolateGeometry.getAttribute("position").array;
    const ghostPos = built.ghostGeometry.getAttribute("position").array;
    expect(isolatePos).toBe(built.assets.displayMesh.vertices);
    expect(ghostPos).toBe(built.assets.displayMesh.vertices);
    expect(isolatePos.length).toBe(mesh.vertices.length);
    expect(ghostPos.length).toBe(mesh.vertices.length);

    expect(Array.from(built.isolateGeometry.getIndex()!.array)).toEqual(
      Array.from(split.isolateIndices),
    );
    expect(Array.from(built.ghostGeometry.getIndex()!.array)).toEqual(
      Array.from(split.ghostIndices),
    );
    expect(built.isolateFaceIds).toEqual([0, 1]);

    spy.mockRestore();
    expect(Array.from(built.assets.displayMesh.vertices)).toEqual(
      Array.from(computeDisplayVertices(mesh.vertices)),
    );
  });
});

describe("ghostMeshRaycast", () => {
  it("returns no hit on the ghost face while Mesh.prototype.raycast does", () => {
    const mesh = makeMesh(
      [-2, -1, 0, -2, 1, 0, -0.2, 0, 0, 0.2, 0, 0, 2, -1, 0, 2, 1, 0],
      [0, 1, 2, 3, 4, 5],
    );
    const mask = maskFromFaces(mesh.faceCount, [0]);
    const built = buildActiveIsolationGeometries(mesh, mask);
    const ghost = built.ghostGeometry;
    const index = ghost.getIndex();
    const position = ghost.getAttribute("position");
    expect(index).not.toBeNull();
    expect(index!.count).toBe(3);

    const centroid = new THREE.Vector3()
      .fromBufferAttribute(position, index!.getX(0))
      .add(new THREE.Vector3().fromBufferAttribute(position, index!.getX(1)))
      .add(new THREE.Vector3().fromBufferAttribute(position, index!.getX(2)))
      .multiplyScalar(1 / 3);

    const raycaster = new THREE.Raycaster();
    raycaster.set(
      centroid.clone().add(new THREE.Vector3(0, 0, 2)),
      new THREE.Vector3(0, 0, -1),
    );

    const blocked = new THREE.Mesh(ghost);
    blocked.raycast = ghostMeshRaycast;
    blocked.updateMatrixWorld(true);
    expect(raycaster.intersectObject(blocked, false)).toEqual([]);

    const open = new THREE.Mesh(ghost);
    open.raycast = THREE.Mesh.prototype.raycast;
    open.updateMatrixWorld(true);
    const hits = raycaster.intersectObject(open, false);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.faceIndex).toBe(0);
  });
});
