export type Vec3 = readonly [number, number, number];
export type Triangle = readonly [Vec3, Vec3, Vec3];

/** Unit cube: 8 welded corners, 12 triangles (matches buildTopology.test CUBE_OBJ). */
export const UNIT_CUBE_TRIANGLES: Triangle[] = [
  [[-1, -1, -1], [1, -1, -1], [1, 1, -1]],
  [[-1, -1, -1], [1, 1, -1], [-1, 1, -1]],
  [[-1, -1, 1], [1, -1, 1], [1, 1, 1]],
  [[-1, -1, 1], [1, 1, 1], [-1, 1, 1]],
  [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1]],
  [[-1, -1, -1], [-1, 1, 1], [-1, 1, -1]],
  [[1, -1, -1], [1, -1, 1], [1, 1, 1]],
  [[1, -1, -1], [1, 1, 1], [1, 1, -1]],
  [[-1, 1, -1], [1, 1, -1], [1, 1, 1]],
  [[-1, 1, -1], [1, 1, 1], [-1, 1, 1]],
  [[-1, -1, -1], [1, -1, -1], [1, -1, 1]],
  [[-1, -1, -1], [1, -1, 1], [-1, -1, 1]],
];

function facetNormal([v0, v1, v2]: Triangle): Vec3 {
  const ax = v1[0] - v0[0];
  const ay = v1[1] - v0[1];
  const az = v1[2] - v0[2];
  const bx = v2[0] - v0[0];
  const by = v2[1] - v0[1];
  const bz = v2[2] - v0[2];
  const nx = ay * bz - az * by;
  const ny = az * bx - ax * bz;
  const nz = ax * by - ay * bx;
  const len = Math.hypot(nx, ny, nz);
  if (len === 0) return [0, 0, 0];
  return [nx / len, ny / len, nz / len];
}

/** Build an ASCII STL string from triangle soup. */
export function buildAsciiStl(name: string, triangles: readonly Triangle[]): string {
  const lines: string[] = [`solid ${name}`];
  for (const tri of triangles) {
    const [nx, ny, nz] = facetNormal(tri);
    lines.push(`  facet normal ${nx} ${ny} ${nz}`);
    lines.push("    outer loop");
    for (const [x, y, z] of tri) {
      lines.push(`      vertex ${x} ${y} ${z}`);
    }
    lines.push("    endloop");
    lines.push("  endfacet");
  }
  lines.push(`endsolid ${name}`);
  return lines.join("\n");
}

export function asciiUnitCubeStl(): string {
  return buildAsciiStl("cube", UNIT_CUBE_TRIANGLES);
}

/** Pad or truncate header text to exactly 80 bytes (binary STL spec). */
export function padStlHeader(text: string): Uint8Array {
  const header = new Uint8Array(80);
  const encoded = new TextEncoder().encode(text);
  header.set(encoded.subarray(0, 80));
  return header;
}

/** Build a binary STL ArrayBuffer from triangle soup. */
export function buildBinaryStl(
  triangles: readonly Triangle[],
  headerText = "binary stl",
): ArrayBuffer {
  const triCount = triangles.length;
  const buffer = new ArrayBuffer(84 + triCount * 50);
  const bytes = new Uint8Array(buffer);
  bytes.set(padStlHeader(headerText), 0);

  const view = new DataView(buffer);
  view.setUint32(80, triCount, true);

  let offset = 84;
  for (const tri of triangles) {
    const [nx, ny, nz] = facetNormal(tri);
    view.setFloat32(offset, nx, true);
    view.setFloat32(offset + 4, ny, true);
    view.setFloat32(offset + 8, nz, true);

    for (let v = 0; v < 3; v++) {
      const [x, y, z] = tri[v]!;
      const base = offset + 12 + v * 12;
      view.setFloat32(base, x, true);
      view.setFloat32(base + 4, y, true);
      view.setFloat32(base + 8, z, true);
    }

    view.setUint16(offset + 48, 0, true);
    offset += 50;
  }

  return buffer;
}

export function binaryUnitCubeStl(): ArrayBuffer {
  return buildBinaryStl(UNIT_CUBE_TRIANGLES);
}

/** Binary STL whose 80-byte header starts with "solid" (false-positive trap for detection). */
export function binaryUnitCubeStlWithSolidHeader(): ArrayBuffer {
  return buildBinaryStl(UNIT_CUBE_TRIANGLES, "solid fake_ascii_header");
}

const PHI = (1 + Math.sqrt(5)) / 2;

const ICOSAHEDRON_CORNERS: Vec3[] = [
  [-1, PHI, 0],
  [1, PHI, 0],
  [-1, -PHI, 0],
  [1, -PHI, 0],
  [0, -1, PHI],
  [0, 1, PHI],
  [0, -1, -PHI],
  [0, 1, -PHI],
  [PHI, 0, -1],
  [PHI, 0, 1],
  [-PHI, 0, -1],
  [-PHI, 0, 1],
];

const ICOSAHEDRON_FACES: [number, number, number][] = [
  [0, 11, 5],
  [0, 5, 1],
  [0, 1, 7],
  [0, 7, 10],
  [0, 10, 11],
  [1, 5, 9],
  [5, 11, 4],
  [11, 10, 2],
  [10, 7, 6],
  [7, 1, 8],
  [3, 9, 4],
  [3, 4, 2],
  [3, 2, 6],
  [3, 6, 8],
  [3, 8, 9],
  [4, 9, 5],
  [2, 4, 11],
  [6, 2, 10],
  [8, 6, 7],
  [9, 8, 1],
];

/** Triangle soup icosahedron (60 unique corners before weld). */
export function unweldedIcosahedronTriangles(): Triangle[] {
  return ICOSAHEDRON_FACES.map(([a, b, c]) => [
    ICOSAHEDRON_CORNERS[a]!,
    ICOSAHEDRON_CORNERS[b]!,
    ICOSAHEDRON_CORNERS[c]!,
  ]);
}
