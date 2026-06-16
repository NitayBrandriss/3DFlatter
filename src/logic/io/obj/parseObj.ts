import type { MeshModel } from "../../mesh/types";
import { weldVertices } from "../../mesh/weldVertices";
import { isConcaveNgons } from "./polygonConvexity";

export class ObjParseError extends Error {
  readonly line: number;

  constructor(message: string, line: number) {
    super(`OBJ parse error (line ${line}): ${message}`);
    this.name = "ObjParseError";
    this.line = line;
  }
}

export type ObjLoadWarning = {
  kind: "concave_ngon";
  line: number;
  vertexCount: number;
};

export type ParseObjResult = {
  mesh: MeshModel;
  warnings: ObjLoadWarning[];
};

function parseVertexIndexToken(token: string, line: number): number {
  // OBJ face tokens can be: v, v/vt, v//vn, v/vt/vn
  const first = token.split("/")[0]?.trim() ?? "";
  const parsed = Number.parseInt(first, 10);
  if (!Number.isFinite(parsed)) {
    throw new ObjParseError(`Invalid face index token "${token}"`, line);
  }
  return parsed;
}

function toZeroBasedIndex(objIndex: number, vertexCount: number, line: number) {
  // OBJ indices are 1-based; negative indices are relative to the end (-1 = last vertex).
  const absOneBased =
    objIndex < 0 ? vertexCount + objIndex + 1 : objIndex; // keep 1-based for now
  const zeroBased = absOneBased - 1;
  if (!Number.isInteger(zeroBased) || zeroBased < 0 || zeroBased >= vertexCount) {
    throw new ObjParseError(
      `Face index ${objIndex} resolves to out-of-range vertex ${zeroBased} (vertexCount=${vertexCount})`,
      line,
    );
  }
  return zeroBased;
}

/**
 * Parse OBJ text into the canonical MeshModel format (ADR 0001):
 * - Supports only `v` and `f` lines
 * - Triangulates faces on load (fan triangulation)
 * - Normalizes to 0-based vertex indices
 * - Welds coincident vertex positions (common in per-face OBJ exports)
 * - Warns on concave n-gons (load continues; fan triangulation unchanged)
 */
export function parseObj(text: string): ParseObjResult {
  const vertices: number[] = [];
  const faces: number[] = [];
  const warnings: ObjLoadWarning[] = [];

  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const raw = lines[i] ?? "";
    const trimmed = raw.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    // Split on runs of whitespace
    const parts = trimmed.split(/\s+/);
    const head = parts[0];

    if (head === "v") {
      if (parts.length < 4) {
        throw new ObjParseError(`Vertex line must be "v x y z"`, lineNumber);
      }

      const x = Number(parts[1]);
      const y = Number(parts[2]);
      const z = Number(parts[3]);
      if (![x, y, z].every(Number.isFinite)) {
        throw new ObjParseError(`Invalid vertex coordinates`, lineNumber);
      }

      vertices.push(x, y, z);
      continue;
    }

    if (head === "f") {
      const vertexCount = vertices.length / 3;
      if (!Number.isInteger(vertexCount) || vertexCount <= 0) {
        throw new ObjParseError(`Face defined before any vertices`, lineNumber);
      }

      const tokens = parts.slice(1);
      if (tokens.length < 3) {
        throw new ObjParseError(`Face must have at least 3 vertices`, lineNumber);
      }

      const polygon: number[] = tokens.map((t) =>
        toZeroBasedIndex(parseVertexIndexToken(t, lineNumber), vertexCount, lineNumber),
      );

      if (polygon.length > 3 && isConcaveNgons(vertices, polygon)) {
        warnings.push({
          kind: "concave_ngon",
          line: lineNumber,
          vertexCount: polygon.length,
        });
      }

      // Fan triangulation: (0,1,2), (0,2,3), ...
      for (let k = 1; k + 1 < polygon.length; k++) {
        const i0 = polygon[0]!;
        const i1 = polygon[k]!;
        const i2 = polygon[k + 1]!;
        faces.push(i0, i1, i2);
      }
      continue;
    }

    // Ignore all other statements in v1 (mtl/usemtl/vn/vt/g/o/s/...)
  }

  const vertexCount = vertices.length / 3;
  if (!Number.isInteger(vertexCount) || vertexCount === 0) {
    throw new ObjParseError(`No vertices found`, 1);
  }

  const faceCount = faces.length / 3;
  if (!Number.isInteger(faceCount) || faceCount === 0) {
    throw new ObjParseError(`No faces found`, 1);
  }

  return {
    mesh: weldVertices(new Float32Array(vertices), new Uint32Array(faces)),
    warnings,
  };
}
