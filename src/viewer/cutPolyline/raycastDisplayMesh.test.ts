import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { unitTriangle } from "../../logic/cuts/cutTestFixtures";
import { tessellateDraftDisplayPath } from "./tessellateDraftDisplayPath";
import { clientToNdc, raycastDisplayMesh } from "./raycastDisplayMesh";
import { writePlacedTwin } from "./cutPolylineHelpers";
import type { DisplayNormalization } from "../displayNormalization";

const IDENTITY_NORM: DisplayNormalization = {
  centerX: 0,
  centerY: 0,
  centerZ: 0,
  scale: 1,
};

describe("clientToNdc", () => {
  it("maps the canvas center to the origin", () => {
    expect(
      clientToNdc(50, 50, { left: 0, top: 0, width: 100, height: 100 }),
    ).toEqual({ x: 0, y: 0 });
  });

  it("maps the top-left corner to (-1, 1)", () => {
    expect(
      clientToNdc(0, 0, { left: 0, top: 0, width: 100, height: 100 }),
    ).toEqual({ x: -1, y: 1 });
  });

  it("returns null for a degenerate rect", () => {
    expect(
      clientToNdc(0, 0, { left: 0, top: 0, width: 0, height: 10 }),
    ).toBeNull();
  });
});

describe("raycastDisplayMesh", () => {
  it("hits a facing triangle at NDC origin", () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]),
        3,
      ),
    );
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry);
    mesh.updateMatrixWorld(true);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 3);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);

    const hit = raycastDisplayMesh(camera, mesh, { x: 0, y: 0 });
    expect(hit).not.toBeNull();
    expect(Math.abs(hit!.z)).toBeLessThan(1e-5);
  });

  it("returns null when the ray misses", () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]),
        3,
      ),
    );
    const mesh = new THREE.Mesh(geometry);
    mesh.updateMatrixWorld(true);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 3);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);

    expect(raycastDisplayMesh(camera, mesh, { x: 0.95, y: 0.95 })).toBeNull();
  });
});

describe("drag retessellate", () => {
  it("rebuilds the overlay from updated twins without dropping length alignment", () => {
    const mesh = unitTriangle();
    const display = [
      { x: 0.1, y: 0.1, z: 0 },
      { x: 0.8, y: 0.1, z: 0 },
      { x: 0.2, y: 0.7, z: 0 },
    ];
    const canonical = display.map((p) => ({ ...p }));
    writePlacedTwin(
      display,
      canonical,
      1,
      { x: 0.5, y: 0.2, z: 0 },
      IDENTITY_NORM,
      false,
    );
    expect(display).toHaveLength(canonical.length);
    const line = tessellateDraftDisplayPath(mesh, canonical, null, IDENTITY_NORM);
    expect(line.length).toBeGreaterThanOrEqual(3);
  });
});
