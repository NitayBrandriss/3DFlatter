const PHI = (1 + Math.sqrt(5)) / 2;

const ICOSAHEDRON_CORNERS: [number, number, number][] = [
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

/** OBJ with 60 vertex lines (3 per face) — typical unwelded exporter output. */
export function unweldedIcosahedronObj(): string {
  const lines: string[] = [];
  let vert = 1;

  for (const [a, b, c] of ICOSAHEDRON_FACES) {
    const faceStart = vert;
    for (const corner of [a, b, c]) {
      const [x, y, z] = ICOSAHEDRON_CORNERS[corner]!;
      lines.push(`v ${x} ${y} ${z}`);
      vert++;
    }
    lines.push(`f ${faceStart} ${faceStart + 1} ${faceStart + 2}`);
  }

  return lines.join("\n");
}
