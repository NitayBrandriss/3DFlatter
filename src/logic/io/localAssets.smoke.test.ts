/**
 * Local-only parse/topology smoke for 3d_models/ (Slice 4).
 * Skips cleanly when the folder is absent. Not part of CI expectations.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_MESH_FILE_BYTES, MAX_MESH_TRIANGLES } from "./loadBudgets";
import { ObjParseError, parseObj } from "./obj/parseObj";
import { parseStl, StlParseError } from "./stl/parseStl";
import { buildTopology } from "../mesh/buildTopology";
import { createSeamRegistry } from "../seams/seamRegistry";
import { listSeamSegments2d } from "../unfold/seamSegments2d";
import { unfoldMesh } from "../unfold/unfoldMesh";

const ROOT = join(process.cwd(), "3d_models");

function collectMeshFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "source") continue; // archives only
      out.push(...collectMeshFiles(full));
      continue;
    }
    const lower = name.toLowerCase();
    if (lower.endsWith(".obj") || lower.endsWith(".stl")) out.push(full);
  }
  return out;
}

const files = collectMeshFiles(ROOT);

describe.skipIf(files.length === 0)("local 3d_models smoke (Slice 4)", () => {
  it.each(files.map((f) => [relative(ROOT, f), f]))(
    "loads %s",
    (label, fullPath) => {
      const size = statSync(fullPath).size;
      expect(size).toBeLessThanOrEqual(MAX_MESH_FILE_BYTES);

      const buf = readFileSync(fullPath);
      const lower = label.toLowerCase();
      let mesh;
      let warnings: { kind: string; count?: number }[] = [];

      try {
        if (lower.endsWith(".obj")) {
          const result = parseObj(buf.toString("utf8"));
          mesh = result.mesh;
          warnings = result.warnings;
        } else {
          const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
          const result = parseStl(ab);
          mesh = result.mesh;
          warnings = result.warnings;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const isBudget =
          (e instanceof StlParseError || e instanceof ObjParseError) &&
          /too many triangles|too large|Soft limit/i.test(msg);
        if (isBudget) {
          console.log(`[smoke] ${label}: soft budget reject (expected for huge assets) — ${msg}`);
          expect(msg).toMatch(/Soft limit|too many triangles|too large/i);
          return;
        }
        // Journey D / HOLISTIC-UI-004: local corrupt_* fixtures must fail parse, not crash smoke.
        if (
          /corrupt/i.test(label) &&
          (e instanceof ObjParseError || e instanceof StlParseError)
        ) {
          console.log(`[smoke] ${label}: parse reject (expected corrupt fixture) — ${msg}`);
          expect(msg.length).toBeGreaterThan(0);
          return;
        }
        throw e;
      }

      expect(mesh.faceCount).toBeGreaterThan(0);
      expect(mesh.faceCount).toBeLessThanOrEqual(MAX_MESH_TRIANGLES);

      const topology = buildTopology(mesh);
      expect(topology.edgeToFaces.size).toBeGreaterThan(0);

      // Unfold only for modest meshes — large local assets are parse/topo smoke only.
      if (mesh.faceCount <= 5_000) {
        const unfolded = unfoldMesh(mesh, topology, createSeamRegistry());
        expect(unfolded.error).toBeUndefined();
        const { segments, skipped } = listSeamSegments2d(
          mesh,
          topology,
          createSeamRegistry(),
          unfolded.islands,
        );
        expect(segments).toHaveLength(0);
        expect(skipped).toHaveLength(0);
        console.log(
          `[smoke] ${label}: verts=${mesh.vertexCount} faces=${mesh.faceCount} ` +
            `skipDeg=${topology.skippedDegenerateFaceCount} warnings=${warnings.length} ` +
            `islands=${unfolded.islands.length}`,
        );
      } else {
        console.log(
          `[smoke] ${label}: verts=${mesh.vertexCount} faces=${mesh.faceCount} ` +
            `skipDeg=${topology.skippedDegenerateFaceCount} warnings=${warnings.length} ` +
            `(parse+topo only; faces>5000)`,
        );
      }
    },
  );
});
