import type { MeshModel } from "../../mesh/types";
import { weldVertices } from "../../mesh/weldVertices";

export class StlParseError extends Error {
  readonly offset?: number;
  readonly line?: number;

  constructor(message: string, opts?: { offset?: number; line?: number }) {
    const loc =
      opts?.line !== undefined
        ? ` (line ${opts.line})`
        : opts?.offset !== undefined
          ? ` (offset ${opts.offset})`
          : "";
    super(`STL parse error${loc}: ${message}`);
    this.name = "StlParseError";
    this.offset = opts?.offset;
    this.line = opts?.line;
  }
}

export type StlLoadWarning = {
  kind: "degenerate_triangle";
  triangleIndex: number;
};

export type ParseStlResult = {
  mesh: MeshModel;
  warnings: StlLoadWarning[];
};

type RawSoup = {
  vertices: Float32Array;
  faces: Uint32Array;
  warnings: StlLoadWarning[];
};

const TRIANGLE_RECORD_SIZE = 50;
const HEADER_SIZE = 80;
const COUNT_OFFSET = 80;

type Vec3 = readonly [number, number, number];

function verticesEqual(a: Vec3, b: Vec3): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function isDegenerateTrianglePositions(a: Vec3, b: Vec3, c: Vec3): boolean {
  return verticesEqual(a, b) || verticesEqual(b, c) || verticesEqual(a, c);
}

function readFiniteFloat(
  view: DataView,
  offset: number,
  littleEndian: boolean,
): number {
  const value = view.getFloat32(offset, littleEndian);
  if (!Number.isFinite(value)) {
    throw new StlParseError("non-finite vertex coordinate", { offset });
  }
  return value;
}

function decodeAsciiPrefix(buffer: ArrayBuffer, maxBytes: number): string {
  const slice = new Uint8Array(buffer, 0, Math.min(maxBytes, buffer.byteLength));
  return new TextDecoder("utf-8").decode(slice).replace(/^\uFEFF/, "").trimStart();
}

function looksLikeAsciiStl(buffer: ArrayBuffer): boolean {
  const prefix = decodeAsciiPrefix(buffer, 256).toLowerCase();
  return prefix.startsWith("solid");
}

function detectStlFormat(buffer: ArrayBuffer): "binary" | "ascii" {
  if (buffer.byteLength < COUNT_OFFSET + 4) {
    throw new StlParseError("file too small to be a valid STL");
  }

  const view = new DataView(buffer);
  const triCount = view.getUint32(COUNT_OFFSET, true);
  const binarySize = COUNT_OFFSET + 4 + triCount * TRIANGLE_RECORD_SIZE;
  const isValidBinarySize = buffer.byteLength >= binarySize && triCount > 0;
  const isEmptyBinary = buffer.byteLength >= binarySize && triCount === 0;

  if (isEmptyBinary) {
    return "binary";
  }

  const looksAscii = looksLikeAsciiStl(buffer);

  if (looksAscii) {
    if (isValidBinarySize) {
      return "binary";
    }
    return "ascii";
  }

  if (isValidBinarySize) {
    return "binary";
  }

  throw new StlParseError("unrecognized STL format");
}

function parseStlBinary(buffer: ArrayBuffer): RawSoup {
  const view = new DataView(buffer);
  const triCount = view.getUint32(COUNT_OFFSET, true);
  const expectedSize = COUNT_OFFSET + 4 + triCount * TRIANGLE_RECORD_SIZE;

  if (triCount === 0) {
    throw new StlParseError("no triangles found");
  }

  if (buffer.byteLength < expectedSize) {
    throw new StlParseError(
      `binary size mismatch: expected at least ${expectedSize} bytes for ${triCount} triangles, got ${buffer.byteLength}`,
    );
  }

  const vertices = new Float32Array(triCount * 9);
  const faces = new Uint32Array(triCount * 3);
  const warnings: StlLoadWarning[] = [];

  let offset = COUNT_OFFSET + 4;
  for (let t = 0; t < triCount; t++) {
    const triVerts: Vec3[] = [];

    for (let v = 0; v < 3; v++) {
      const vi = t * 3 + v;
      const base = vi * 3;
      const vertOffset = offset + 12 + v * 12;
      const x = readFiniteFloat(view, vertOffset, true);
      const y = readFiniteFloat(view, vertOffset + 4, true);
      const z = readFiniteFloat(view, vertOffset + 8, true);
      vertices[base] = x;
      vertices[base + 1] = y;
      vertices[base + 2] = z;
      faces[vi] = vi;
      triVerts.push([x, y, z]);
    }

    if (isDegenerateTrianglePositions(triVerts[0]!, triVerts[1]!, triVerts[2]!)) {
      warnings.push({ kind: "degenerate_triangle", triangleIndex: t });
    }

    offset += TRIANGLE_RECORD_SIZE;
  }

  return { vertices, faces, warnings };
}

function parseVertexLine(parts: string[], lineNumber: number): [number, number, number] {
  if (parts.length < 4 || parts[0]?.toLowerCase() !== "vertex") {
    throw new StlParseError(`expected "vertex x y z"`, { line: lineNumber });
  }

  const x = Number(parts[1]);
  const y = Number(parts[2]);
  const z = Number(parts[3]);
  if (![x, y, z].every(Number.isFinite)) {
    throw new StlParseError("invalid vertex coordinates", { line: lineNumber });
  }

  return [x, y, z];
}

function pushAsciiFacet(
  facetVerts: [number, number, number][],
  vertices: number[],
  faces: number[],
  warnings: StlLoadWarning[],
  triangleIndex: number,
  lineNumber: number,
): void {
  if (facetVerts.length !== 3) {
    throw new StlParseError(
      `facet must have exactly 3 vertices (found ${facetVerts.length})`,
      { line: lineNumber },
    );
  }

  const base = vertices.length / 3;
  for (const [x, y, z] of facetVerts) {
    vertices.push(x, y, z);
  }
  faces.push(base, base + 1, base + 2);

  const [a, b, c] = facetVerts;
  if (isDegenerateTrianglePositions(a!, b!, c!)) {
    warnings.push({ kind: "degenerate_triangle", triangleIndex });
  }
}

function parseStlAscii(text: string): RawSoup {
  const vertices: number[] = [];
  const faces: number[] = [];
  const warnings: StlLoadWarning[] = [];
  const lines = text.split(/\r?\n/);

  let facetVerts: [number, number, number][] = [];
  let inFacet = false;
  let inLoop = false;
  let triangleIndex = 0;
  let sawFacet = false;

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const trimmed = (lines[i] ?? "").trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const parts = trimmed.split(/\s+/);
    const head = parts[0]?.toLowerCase() ?? "";

    if (head === "solid") {
      continue;
    }

    if (head === "facet") {
      if (inFacet) {
        throw new StlParseError("nested facet", { line: lineNumber });
      }
      inFacet = true;
      facetVerts = [];
      continue;
    }

    if (head === "outer" && parts[1]?.toLowerCase() === "loop") {
      if (!inFacet || inLoop) {
        throw new StlParseError("outer loop outside facet", { line: lineNumber });
      }
      inLoop = true;
      continue;
    }

    if (head === "vertex") {
      if (!inFacet || !inLoop) {
        throw new StlParseError("vertex outside outer loop", { line: lineNumber });
      }
      facetVerts.push(parseVertexLine(parts, lineNumber));
      continue;
    }

    if (head === "endloop") {
      if (!inLoop) {
        throw new StlParseError("endloop without outer loop", { line: lineNumber });
      }
      inLoop = false;
      continue;
    }

    if (head === "endfacet") {
      if (!inFacet) {
        throw new StlParseError("endfacet without facet", { line: lineNumber });
      }
      if (inLoop) {
        throw new StlParseError("facet ended before endloop", { line: lineNumber });
      }
      pushAsciiFacet(facetVerts, vertices, faces, warnings, triangleIndex, lineNumber);
      sawFacet = true;
      triangleIndex++;
      inFacet = false;
      facetVerts = [];
      continue;
    }

    if (head === "endsolid") {
      continue;
    }

    throw new StlParseError(`unrecognized line "${trimmed}"`, { line: lineNumber });
  }

  if (inFacet || inLoop) {
    throw new StlParseError("unexpected end of file inside facet");
  }

  if (!sawFacet) {
    throw new StlParseError("no triangles found");
  }

  return {
    vertices: new Float32Array(vertices),
    faces: new Uint32Array(faces),
    warnings,
  };
}

function finalizeMesh(raw: RawSoup): ParseStlResult {
  const mesh = weldVertices(raw.vertices, raw.faces);

  if (mesh.vertexCount === 0 || mesh.faceCount === 0) {
    throw new StlParseError("no geometry after welding");
  }

  for (let i = 0; i < mesh.faces.length; i++) {
    const idx = mesh.faces[i]!;
    if (idx >= mesh.vertexCount) {
      throw new StlParseError(`face index ${idx} out of range (vertexCount=${mesh.vertexCount})`);
    }
  }

  return { mesh, warnings: raw.warnings };
}

/**
 * Parse STL (ASCII or binary) into canonical MeshModel (ADR 0001):
 * - Detects format via binary size heuristic, then ASCII keyword fallback
 * - Emits triangle soup, then welds coincident vertex positions
 */
export function parseStl(buffer: ArrayBuffer): ParseStlResult {
  const format = detectStlFormat(buffer);
  const raw =
    format === "binary"
      ? parseStlBinary(buffer)
      : parseStlAscii(new TextDecoder("utf-8").decode(buffer));

  return finalizeMesh(raw);
}
