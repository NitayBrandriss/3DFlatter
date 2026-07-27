import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getBundledDemoMesh } from "@/logic/io/demoMeshes";
import { getDemoModelById } from "@/data/demoModels";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const model = getDemoModelById(id);
  if (!model) {
    return NextResponse.json({ error: "Unknown demo model" }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), "3d_models", model.relativePath);

  const contentType = model.fileName.endsWith(".stl")
    ? "model/stl"
    : "text/plain";
  const headers = {
    "Content-Type": contentType,
    "Content-Disposition": `inline; filename="${model.fileName}"`,
  };

  try {
    const data = await readFile(filePath);
    return new NextResponse(data, { headers });
  } catch {
    const bundled = getBundledDemoMesh(id);
    if (!bundled) {
      return NextResponse.json(
        { error: "Demo model file not found on disk" },
        { status: 404 },
      );
    }

    return new NextResponse(bundled.text, { headers });
  }
}
