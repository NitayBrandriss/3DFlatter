import { useCallback, useEffect, useState } from "react";
import { buildSvgDocument } from "@/logic/export/svg/buildSvgDocument";
import type { UnfoldMeshResult } from "@/logic/mesh/types";
import { unfoldMesh } from "@/logic/unfold/unfoldMesh";
import type { MeshSession } from "@/state/meshSessionStore";
import { downloadTextFile, svgFileNameFromObj } from "./download";

type NotifyToast = (text: string, tone?: "info" | "warning") => void;

export function useFlattenExport(session: MeshSession | null, notifyToast: NotifyToast) {
  const [flattenResult, setFlattenResult] = useState<UnfoldMeshResult | null>(null);
  const [flattening, setFlattening] = useState(false);
  const [includeSeamsInExport, setIncludeSeamsInExport] = useState(true);

  useEffect(() => {
    setFlattenResult(null);
  }, [session]);

  const onFlatten = useCallback(() => {
    if (!session) return;
    setFlattening(true);
    try {
      const result = unfoldMesh(session.mesh, session.topology, session.seams);
      if (result.error) {
        notifyToast(result.error, "warning");
        setFlattenResult(null);
        return;
      }
      setFlattenResult(result);
    } finally {
      setFlattening(false);
    }
  }, [session, notifyToast]);

  const onExportSvg = useCallback(() => {
    if (!flattenResult || flattenResult.error) return;
    try {
      const fileName = session ? svgFileNameFromObj(session.fileName) : "pattern.svg";
      const { svg } = buildSvgDocument(flattenResult, {
        tier: "preview",
        includeSeams: includeSeamsInExport,
        title: session?.fileName ?? "Flattened mesh pattern",
      });
      downloadTextFile(svg, fileName, "image/svg+xml");
      notifyToast(`Exported ${fileName}`, "info");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      notifyToast(message, "warning");
    }
  }, [flattenResult, includeSeamsInExport, notifyToast, session]);

  return {
    flattenResult,
    flattening,
    includeSeamsInExport,
    setIncludeSeamsInExport,
    onFlatten,
    onExportSvg,
  };
}
