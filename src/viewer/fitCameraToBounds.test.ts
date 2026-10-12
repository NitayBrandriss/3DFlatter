import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { maskFromFaces } from "../logic/isolation/faceMask";
import {
  displayBoundsOfPositions,
  isolateDisplayBounds,
  splitIsolationIndexBuffers,
} from "../logic/isolation/maskGeometry";
import { openTube, tubeBandFaces } from "../logic/isolation/testMeshes";
import { computeDisplayVertices } from "./displayNormalization";
import {
  applyFitCameraToBounds,
  frameBoundsForIsolation,
  isolationFrameKey,
} from "./fitCameraToBounds";

function centersDiffer(
  a: { centerX: number; centerY: number; centerZ: number },
  b: { centerX: number; centerY: number; centerZ: number },
): boolean {
  return (
    Math.abs(a.centerX - b.centerX) > 1e-6 ||
    Math.abs(a.centerY - b.centerY) > 1e-6 ||
    Math.abs(a.centerZ - b.centerZ) > 1e-6
  );
}

describe("isolation framing", () => {
  it("frames the isolate center of openTube band 0, not the full mesh", () => {
    const mesh = openTube(5, 4);
    const display = computeDisplayVertices(mesh.vertices);
    const full = displayBoundsOfPositions(display);
    expect(full).not.toBeNull();

    const band0 = maskFromFaces(mesh.faceCount, tubeBandFaces(0, 4));
    const split0 = splitIsolationIndexBuffers(mesh, band0);
    const isolate0 = isolateDisplayBounds(display, split0.isolateIndices);
    expect(isolate0).not.toBeNull();
    expect(centersDiffer(isolate0!, full!)).toBe(true);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    const target = new THREE.Vector3(9, 9, 9);
    let updates = 0;
    const controls = {
      target,
      update() {
        updates += 1;
      },
    };

    const inactive = frameBoundsForIsolation(false, full!, isolate0);
    expect(inactive).toBe(full);
    applyFitCameraToBounds(camera, controls, inactive);
    const fovRad = (camera.fov * Math.PI) / 180;
    const distance = (inactive.radius || 1) / Math.sin(fovRad / 2);
    expect(camera.near).toBeCloseTo(Math.max(0.01, distance / 100));
    expect(camera.far).toBeCloseTo(distance * 100);
    expect(target.x).toBeCloseTo(full!.centerX);
    expect(target.y).toBeCloseTo(full!.centerY);
    expect(target.z).toBeCloseTo(full!.centerZ);

    const active = frameBoundsForIsolation(true, full!, isolate0);
    expect(active).toBe(isolate0);
    applyFitCameraToBounds(camera, controls, active);
    expect(target.x).toBeCloseTo(isolate0!.centerX);
    expect(target.y).toBeCloseTo(isolate0!.centerY);
    expect(target.z).toBeCloseTo(isolate0!.centerZ);
    expect(updates).toBe(2);

    const band3 = maskFromFaces(mesh.faceCount, tubeBandFaces(3, 4));
    const split3 = splitIsolationIndexBuffers(mesh, band3);
    const isolate3 = isolateDisplayBounds(display, split3.isolateIndices);
    expect(isolate3).not.toBeNull();
    expect(centersDiffer(isolate3!, isolate0!)).toBe(true);
    expect(isolationFrameKey(false, band0)).toBe("full");
    expect(isolationFrameKey(false, band3)).toBe("full");
    expect(isolationFrameKey(true, band0)).not.toBe(isolationFrameKey(false, band0));
    expect(isolationFrameKey(true, band0)).not.toBe(isolationFrameKey(true, band3));

    applyFitCameraToBounds(
      camera,
      controls,
      frameBoundsForIsolation(true, full!, isolate3),
    );
    expect(target.y).toBeCloseTo(isolate3!.centerY);
    expect(Math.abs(target.y - isolate0!.centerY)).toBeGreaterThan(1e-6);
  });
});
