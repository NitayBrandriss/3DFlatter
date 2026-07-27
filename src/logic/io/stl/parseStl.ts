import { WELD_EPSILON } from "../../geom2d/tolerances";
import type { MeshModel } from "../../mesh/types";
import { weldVertices } from "../../mesh/weldVertices";
import { formatByteLimit, MAX_MESH_FILE_BYTES, MAX_MESH_TRIANGLES } from "../loadBudgets";

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

/** Matches OBJ weld/import warnings — aggregate count, not per-triangle rows. */
export type StlLoadWarning = {
  kind: "degenerate_triangle";
  count: number;
};

export type ParseStlResult = {
  mesh: MeshModel;
  warnings: StlLoadWarning[];
};

type RawSoup = {
  vertices: Float32Array;
  faces: Uint32Array;
  /** Geometric collapses detected before weld (epsilon-near coincident corners). */
  preWeldDegenerateCount: number;
};
const TRIANGLE_RECORD_SIZE = 50;
const COUNT_OFFSET = 80;

type Vec3 = readonly [number, number, number];

function verticesNearEqual(a: Vec3, b: Vec3, eps = WELD_EPSILON): boolean {
  return (
    Math.abs(a[0] - b[0]) <= eps &&
    Math.abs(a[1] - b[1]) <= eps &&
    Math.abs(a[2] - b[2]) <= eps
  );
}

function isDegenerateTrianglePositions(a: Vec3, b: Vec3, c: Vec3): boolean {
  return (
    verticesNearEqual(a, b) || verticesNearEqual(b, c) || verticesNearEqual(a, c)
  );
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

type BinaryLayout = {
  triCount: number;
  binarySize: number;
  isValidBinarySize: boolean;
  isEmptyBinary: boolean;
};

function inspectBinaryLayout(buffer: ArrayBuffer): BinaryLayout {
  if (buffer.byteLength < COUNT_OFFSET + 4) {
    throw new StlParseError("file too small to be a valid STL");
  }

  const view = new DataView(buffer);
  const triCount = view.getUint32(COUNT_OFFSET, true);
  const binarySize = COUNT_OFFSET + 4 + triCount * TRIANGLE_RECORD_SIZE;
  const isValidBinarySize = buffer.byteLength >= binarySize && triCount > 0;
  const isEmptyBinary = buffer.byteLength >= binarySize && triCount === 0;
  return { triCount, binarySize, isValidBinarySize, isEmptyBinary };
}

function assertTriangleBudget(triCount: number): void {
  if (triCount > MAX_MESH_TRIANGLES) {
    throw new StlParseError(
      `too many triangles (${triCount.toLocaleString()}). Soft limit is ${MAX_MESH_TRIANGLES.toLocaleString()}.`,
    );
  }
}

function parseStlBinary(buffer: ArrayBuffer): RawSoup {
  const { triCount, binarySize } = inspectBinaryLayout(buffer);
  assertTriangleBudget(triCount);

  if (triCount === 0) {
    throw new StlParseError("no triangles found");
  }

  if (buffer.byteLength < binarySize) {
    throw new StlParseError(
      `binary size mismatch: expected at least ${binarySize} bytes for ${triCount} triangles, got ${buffer.byteLength}`,
    );
  }

  const view = new DataView(buffer);
  const vertices = new Float32Array(triCount * 9);
  const faces = new Uint32Array(triCount * 3);
  let preWeldDegenerateCount = 0;

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
      preWeldDegenerateCount++;
    }

    offset += TRIANGLE_RECORD_SIZE;
  }

  return { vertices, faces, preWeldDegenerateCount };
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
  lineNumber: number,
): boolean {
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
  return isDegenerateTrianglePositions(a!, b!, c!);
}

function parseStlAscii(text: string): RawSoup {
  const vertices: number[] = [];
  const faces: number[] = [];
  let preWeldDegenerateCount = 0;
  const lines = text.split(/\r?\n/);

  let facetVerts: [number, number, number][] = [];
  let inFacet = false;
  let inLoop = false;
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
      if (pushAsciiFacet(facetVerts, vertices, faces, lineNumber)) {
        preWeldDegenerateCount++;
      }
      assertTriangleBudget(faces.length / 3);
      sawFacet = true;
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
    preWeldDegenerateCount,
  };
}

function finalizeMesh(raw: RawSoup): ParseStlResult {
  const { mesh, removedDegenerateFaceCount } = weldVertices(raw.vertices, raw.faces);

  if (mesh.vertexCount === 0 || mesh.faceCount === 0) {
    throw new StlParseError("no geometry after welding");
  }

  for (let i = 0; i < mesh.faces.length; i++) {
    const idx = mesh.faces[i]!;
    if (idx >= mesh.vertexCount) {
      throw new StlParseError(`face index ${idx} out of range (vertexCount=${mesh.vertexCount})`);
    }
  }

  // Prefer the larger of pre-weld geometric detections vs faces dropped by weld.
  const count = Math.max(raw.preWeldDegenerateCount, removedDegenerateFaceCount);
  const warnings: StlLoadWarning[] =
    count > 0 ? [{ kind: "degenerate_triangle", count }] : [];

  return { mesh, warnings };
}

/**
 * Parse STL (ASCII or binary) into canonical MeshModel (ADR 0001).
 * Prefers ASCII when the buffer looks ASCII; falls back to binary when ASCII
 * fails and the binary size layout is valid (IO-001).
 */
export function parseStl(buffer: ArrayBuffer): ParseStlResult {
  if (buffer.byteLength > MAX_MESH_FILE_BYTES) {
    throw new StlParseError(
      `file too large (${formatByteLimit(buffer.byteLength)}). Soft limit is ${formatByteLimit(MAX_MESH_FILE_BYTES)}.`,
    );
  }

  const layout = inspectBinaryLayout(buffer);
  const tryAscii = looksLikeAsciiStl(buffer);

  if (tryAscii) {
    try {
      return finalizeMesh(parseStlAscii(new TextDecoder("utf-8").decode(buffer)));
    } catch (asciiErr) {
      if (layout.isValidBinarySize) {
        try {
          return finalizeMesh(parseStlBinary(buffer));
        } catch {
          throw asciiErr instanceof Error ? asciiErr : new StlParseError(String(asciiErr));
        }
      }
      throw asciiErr;
    }
  }

  if (layout.triCount > MAX_MESH_TRIANGLES) {
    throw new StlParseError(
      `too many triangles (${layout.triCount.toLocaleString()}). Soft limit is ${MAX_MESH_TRIANGLES.toLocaleString()}.`,
    );
  }

  if (layout.isValidBinarySize || layout.isEmptyBinary) {
    return finalizeMesh(parseStlBinary(buffer));
  }

  throw new StlParseError("unrecognized STL format");
}
