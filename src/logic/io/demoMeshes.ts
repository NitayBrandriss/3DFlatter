import { unweldedIcosahedronObj } from "./obj/testMeshes";
import { asciiUnitCubeStl } from "./stl/testMeshes";

type Vec3 = readonly [number, number, number];
type Triangle = readonly [Vec3, Vec3, Vec3];

function boxTriangles(min: Vec3, max: Vec3): Triangle[] {
  const [minX, minY, minZ] = min;
  const [maxX, maxY, maxZ] = max;
  const corners: Vec3[] = [
    [minX, minY, minZ],
    [maxX, minY, minZ],
    [maxX, maxY, minZ],
    [minX, maxY, minZ],
    [minX, minY, maxZ],
    [maxX, minY, maxZ],
    [maxX, maxY, maxZ],
    [minX, maxY, maxZ],
  ];
  return [
    [corners[0]!, corners[1]!, corners[2]!],
    [corners[0]!, corners[2]!, corners[3]!],
    [corners[4]!, corners[5]!, corners[6]!],
    [corners[4]!, corners[6]!, corners[7]!],
    [corners[0]!, corners[4]!, corners[7]!],
    [corners[0]!, corners[7]!, corners[3]!],
    [corners[1]!, corners[5]!, corners[6]!],
    [corners[1]!, corners[6]!, corners[2]!],
    [corners[3]!, corners[2]!, corners[6]!],
    [corners[3]!, corners[6]!, corners[7]!],
    [corners[0]!, corners[1]!, corners[5]!],
    [corners[0]!, corners[5]!, corners[4]!],
  ];
}

function trianglesToObj(triangles: readonly Triangle[]): string {
  const lines: string[] = [];
  let vert = 1;

  for (const [a, b, c] of triangles) {
    const faceStart = vert;
    for (const [x, y, z] of [a, b, c]) {
      lines.push(`v ${x} ${y} ${z}`);
      vert++;
    }
    lines.push(`f ${faceStart} ${faceStart + 1} ${faceStart + 2}`);
  }

  return lines.join("\n");
}

/** Block-letter M: triangle-soup OBJ bundled for deployed demos. */
export function blockLetterMObj(): string {
  const boxes: [Vec3, Vec3][] = [
    [[-2, 0, -0.3], [-1.1, 3, 0.3]],
    [[1.1, 0, -0.3], [2, 3, 0.3]],
    [[-1.1, 1.4, -0.3], [-0.05, 3, 0.3]],
    [[-0.05, 1.4, -0.3], [1.1, 3, 0.3]],
  ];
  return trianglesToObj(boxes.flatMap(([min, max]) => boxTriangles(min, max)));
}

export type BundledDemoMesh = {
  text: string;
};

/** Built-in demo meshes used when gitignored 3d_models/ files are absent (e.g. production). */
export function getBundledDemoMesh(id: string): BundledDemoMesh | undefined {
  switch (id) {
    case "d20":
      return { text: unweldedIcosahedronObj() };
    case "cube":
      return { text: asciiUnitCubeStl() };
    case "big-m":
      return { text: blockLetterMObj() };
    default:
      return undefined;
  }
}
