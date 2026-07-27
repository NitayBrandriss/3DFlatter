import { describe, expect, it } from "vitest";
import { parseObj } from "./obj/parseObj";
import { parseStl } from "./stl/parseStl";
import { getBundledDemoMesh } from "./demoMeshes";
import { DEMO_MODELS } from "@/data/demoModels";

function encodeText(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

describe("getBundledDemoMesh", () => {
  it("provides parseable content for every registered demo model", () => {
    for (const demo of DEMO_MODELS) {
      const bundled = getBundledDemoMesh(demo.id);
      expect(bundled, demo.id).toBeDefined();

      if (demo.fileName.endsWith(".stl")) {
        const { mesh } = parseStl(encodeText(bundled!.text));
        expect(mesh.vertexCount).toBeGreaterThan(0);
        expect(mesh.faceCount).toBeGreaterThan(0);
      } else {
        const { mesh } = parseObj(bundled!.text);
        expect(mesh.vertexCount).toBeGreaterThan(0);
        expect(mesh.faceCount).toBeGreaterThan(0);
      }
    }
  });
});
