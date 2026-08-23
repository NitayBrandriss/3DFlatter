import { describe, expect, it } from "vitest";
import { foldedDihedralQuad, v } from "./cutTestFixtures";
import { findExitEdgeSurfaceWalk } from "./cutSurfaceWalk";
import { barycentric, snapEpsilonForMesh, surfaceEpsilonForMesh } from "./vec3";
import { WorkingMesh } from "./workingMesh";

describe("cutSurfaceWalk", () => {
  it("locates wing B interior points on folded dihedral quad", () => {
    const mesh = foldedDihedralQuad();
    const eps = snapEpsilonForMesh(mesh);
    const surfaceEps = surfaceEpsilonForMesh(mesh);
    const working = new WorkingMesh(mesh, new Set(), eps, surfaceEps);

    expect(working.locate(v(0, 0.2, 0.3)).kind).not.toBe("none");
    expect(working.locate(v(0, 0.4, 0.3)).kind).not.toBe("none");
  });

  it("finds exit edge across 90° dihedral from wing A to wing B", () => {
    const mesh = foldedDihedralQuad();
    const eps = snapEpsilonForMesh(mesh);
    const surfaceEps = surfaceEpsilonForMesh(mesh);
    const working = new WorkingMesh(mesh, new Set(), eps, surfaceEps);

    const locA = working.locate(v(0.5, 0.3, 0));
    const locB = working.locate(v(0, 0.3, 0.5));
    expect(locA.kind).toBe("face");
    expect(locB.kind).toBe("face");

    const vA = working.ensureVertex(locA)!;
    const vB = working.ensureVertex(locB)!;
    expect(vA).not.toBe(vB);

    const goal = working.getVertex(vB);

    let goalFace = -1;
    for (let fi = 0; fi < working.faces.length; fi++) {
      const [ia, ib, ic] = working.faces[fi]!;
      const bary = barycentric(
        goal,
        working.getVertex(ia),
        working.getVertex(ib),
        working.getVertex(ic),
      );
      if (bary && bary.u >= -1e-4 && bary.v >= -1e-4 && bary.w >= -1e-4) {
        goalFace = fi;
        break;
      }
    }
    expect(goalFace).toBeGreaterThanOrEqual(0);

    const exit = findExitEdgeSurfaceWalk(working, vA, goal, null);
    expect(exit).not.toBeNull();
  });
});
