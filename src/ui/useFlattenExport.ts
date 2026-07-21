import { useCallback, useState } from "react";
import { buildSvgDocument } from "@/logic/export/svg/buildSvgDocument";
import type { UnfoldMeshResult } from "@/logic/mesh/types";
import {
  countQualityIssues,
  formatQualityIssueToast,
  type QualityIssueCounts,
} from "@/logic/unfold/qualitySummary";
import { unfoldMesh } from "@/logic/unfold/unfoldMesh";
import type { MeshSession } from "@/state/meshSessionStore";
import { downloadTextFile, svgFileNameFromMesh } from "./download";

type NotifyToast = (text: string, tone?: "info" | "warning") => void;

type QualityOverlayState = {
  meshVersion: number;
  show: boolean;
  autoEnabled: boolean;
};

function defaultQualityOverlayState(meshVersion: number): QualityOverlayState {
  return { meshVersion, show: false, autoEnabled: false };
}

function resolveQualityOverlayState(
  state: QualityOverlayState,
  meshLoadVersion: number,
): QualityOverlayState {
  return state.meshVersion === meshLoadVersion
    ? state
    : defaultQualityOverlayState(meshLoadVersion);
}

/**
 * Flatten/export UI state (ARCH-003 dual-ownership contract):
 *
 * - **Session (Zustand)** owns mesh, topology, and live seams. Seam toggles update
 *   session only — they must not bump `meshLoadVersion` (AGENTS.md invariant).
 * - **Flatten snapshot (this hook)** owns the last successful `unfoldMesh` result,
 *   gated by `meshLoadVersion`. Seam edits keep the prior pattern visible until the
 *   user re-flattens; identity matching is version equality, not seams equality.
 * - No separate flatten Zustand store: the snapshot is page-local UI state.
 *   Revisit only if remount survival or cross-route access becomes a requirement.
 *
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
  const [qualityOverlayState, setQualityOverlayState] = useState(() =>
    defaultQualityOverlayState(meshLoadVersion),
  );

  const activeQualityOverlay = resolveQualityOverlayState(
    qualityOverlayState,
    meshLoadVersion,
  );

  const flattenResult =
    flattenSnapshot && flattenSnapshot.version === meshLoadVersion
      ? flattenSnapshot.result
      : null;

  const qualityCounts: QualityIssueCounts | null = flattenResult
    ? countQualityIssues(flattenResult)
    : null;

  const setShowQualityOverlay = useCallback(
    (show: boolean) => {
      setQualityOverlayState((prev) => {
        const base = resolveQualityOverlayState(prev, meshLoadVersion);
        return { ...base, show };
      });
    },
    [meshLoadVersion],
  );

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
      const counts = countQualityIssues(result);
      const qualityToast = formatQualityIssueToast(counts);
      if (qualityToast) {
        notifyToast(qualityToast, "warning");
        setQualityOverlayState((prev) => {
          const base = resolveQualityOverlayState(prev, meshLoadVersion);
          if (base.autoEnabled) return base;
          return { meshVersion: meshLoadVersion, show: true, autoEnabled: true };
        });
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
    showQualityOverlay: flattenResult ? activeQualityOverlay.show : false,
    setShowQualityOverlay,
    qualityCounts,
    onFlatten,
    onExportSvg,
  };
}
