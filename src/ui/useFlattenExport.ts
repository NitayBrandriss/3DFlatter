import { useCallback, useState } from "react";
import { buildSvgDocument } from "@/logic/export/svg/buildSvgDocument";
import type { UnfoldMeshResult } from "@/logic/mesh/types";
import { unfoldMesh } from "@/logic/unfold/unfoldMesh";
import type { MeshSession } from "@/state/meshSessionStore";
import { downloadTextFile, svgFileNameFromMesh } from "./download";

type NotifyToast = (text: string, tone?: "info" | "warning") => void;

/**
 * Flatten/export UI state.
 * Result is tied to `meshLoadVersion` so seam toggles do not clear it (STATE-002).
 * After seam edits, re-flatten for an accurate pattern.
 */
export function useFlattenExport(
  session: MeshSession | null,
  meshLoadVersion: number,
  notifyToast: NotifyToast,
) {
  const [flattenSnapshot, setFlattenSnapshot] = useState<{
    version: number;
    result: UnfoldMeshResult;
  } | null>(null);
  const [flattening, setFlattening] = useState(false);
  const [includeSeamsInExport, setIncludeSeamsInExport] = useState(true);

  const flattenResult =
    flattenSnapshot && flattenSnapshot.version === meshLoadVersion
      ? flattenSnapshot.result
      : null;

  const onFlatten = useCallback((): boolean => {
    if (!session) return false;
    setFlattening(true);
    try {
      const result = unfoldMesh(session.mesh, session.topology, session.seams);
      if (result.error) {
        notifyToast(result.error, "warning");
        setFlattenSnapshot(null);
        return false;
      }
      if (result.warnings && result.warnings.length > 0) {
        notifyToast(
          result.warnings.length === 1
            ? result.warnings[0]!
            : `${result.warnings.length} islands failed to unfold; showing the rest.`,
          "warning",
        );
      }
      setFlattenSnapshot({ version: meshLoadVersion, result });
      return true;
    } finally {
      setFlattening(false);
    }
  }, [session, meshLoadVersion, notifyToast]);

  const onExportSvg = useCallback(() => {
    if (!flattenResult || flattenResult.error) return;
    try {
      const fileName = session ? svgFileNameFromMesh(session.fileName) : "pattern.svg";
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
