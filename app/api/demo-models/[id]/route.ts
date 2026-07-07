import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getDemoModelById } from "@/ui/demoModels";

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

  try {
    const data = await readFile(filePath);
    const contentType = model.fileName.endsWith(".stl")
      ? "model/stl"
      : "text/plain";

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${model.fileName}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Demo model file not found on disk" },
      { status: 404 },
    );
  }
}
