import { useCallback, useState } from "react";
import { flattenWithCutStrokes } from "@/logic/cuts/flattenWithCutStrokes";
import type { CutStroke } from "@/logic/cuts/types";
import { buildSvgDocument } from "@/logic/export/svg/buildSvgDocument";
import type { UnfoldMeshResult } from "@/logic/mesh/types";
import {
  countQualityIssues,
  formatQualityIssueToast,
  type QualityIssueCounts,
} from "@/logic/unfold/qualitySummary";
import {
  flattenSnapshotKey,
  isolationContentKey,
  seamsContentKey,
  type IsolationOverlay,
  type MeshSession,
} from "@/state/meshSessionStore";
import { downloadTextFile, svgFileNameFromMesh } from "./download";
import { formatIsolationSkipToast } from "./formatIsolationSkipToast";
import { formatMaterializeWarningsToast } from "./formatMaterializeWarningsToast";
import {
  defaultQualityOverlayState,
  isFlattenSnapshotCurrent,
  resolveQualityOverlayState,
} from "./flattenSnapshotUi";

type NotifyToast = (text: string, tone?: "info" | "warning") => void;

/**
 * Flatten/export UI state (ARCH-003 dual-ownership contract):
 *
 * - **Session (Zustand)** owns mesh, topology, live seams, and `cutStrokes`.
 *   Seam toggles and stroke edits must not bump `meshLoadVersion` (AGENTS.md).
 *   Stroke CRUD bumps `patternRevision` only; seam membership enters the
 *   flatten key via `seamsContentKey` (ADR 0100). Isolation mask bits and
 *   `active` enter via `isolationContentKey` (ADR 0101) without a revision bump.
 * - **Flatten snapshot (this hook)** owns the last successful unfold result,
 *   keyed by `flattenSnapshotKey(meshLoadVersion, patternRevision, seamsKey, isolationKey)`.
 *   Seam, stroke, or isolation edits stale the snapshot (2D clears until re-Flatten).
 * - On Flatten: `flattenWithCutStrokes` (subset when `isolation.active`) then
 *   unfold. A skip toast, then materialize warnings, then quality toasts.
 *   A throw toasts `error.message`, clears the snapshot, and returns false.
 * - No separate flatten Zustand store: the snapshot is page-local UI state.
 */
export function useFlattenExport(
  session: MeshSession | null,
  meshLoadVersion: number,
  patternRevision: number,
  isolation: Pick<IsolationOverlay, "active" | "mask">,
  cutStrokes: readonly CutStroke[],
  notifyToast: NotifyToast,
) {
  const [flattenSnapshot, setFlattenSnapshot] = useState<{
    key: string;
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

  const seamsKey = session ? seamsContentKey(session.seams) : "";
  const isolationKey = isolationContentKey(isolation.active, isolation.mask);
  const snapshotKey = flattenSnapshotKey(
    meshLoadVersion,
    patternRevision,
    seamsKey,
    isolationKey,
  );
  const flattenResult =
    flattenSnapshot &&
    isFlattenSnapshotCurrent(flattenSnapshot.key, snapshotKey)
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
      const {
        unfold: result,
        materializeWarnings,
        openLoops,
        skippedStrokes,
      } = flattenWithCutStrokes({
        mesh: session.mesh,
        topology: session.topology,
        seams: session.seams,
        cutStrokes,
        isolation: { active: isolation.active, mask: isolation.mask },
      });

      const skipToast = formatIsolationSkipToast(skippedStrokes);
      if (skipToast) {
        notifyToast(skipToast, "warning");
      }

      const materializeToast = formatMaterializeWarningsToast(
        materializeWarnings,
        openLoops,
      );
      if (materializeToast) {
        notifyToast(materializeToast, "warning");
      }

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
      setFlattenSnapshot({
        key: flattenSnapshotKey(
          meshLoadVersion,
          patternRevision,
          seamsContentKey(session.seams),
          isolationContentKey(isolation.active, isolation.mask),
        ),
        result,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      notifyToast(message, "warning");
      setFlattenSnapshot(null);
      return false;
    } finally {
      setFlattening(false);
    }
  }, [session, meshLoadVersion, patternRevision, isolation, cutStrokes, notifyToast]);

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
