"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyLayoutTokensToDocument } from "@/ui/layout/applyLayoutTokens";
import { AppLayout } from "@/ui/layout/AppLayout";
import { AppSidebar } from "@/ui/layout/AppSidebar";
import { usePeekThrough } from "@/ui/layout/usePeekThrough";
import { useResizableSplit } from "@/ui/layout/useResizableSplit";
import { useSidebarState } from "@/ui/layout/useSidebarState";
import { ViewportChrome } from "@/ui/layout/ViewportChrome";
import type { MobilePanel } from "@/ui/layout/ViewportChrome";
import { CutDraftToolbar } from "@/ui/layout/CutDraftToolbar";
import { UnfoldViewer2D } from "@/ui/UnfoldViewer2D";
import { useFlattenExport } from "@/ui/useFlattenExport";
import { useHomeSession } from "@/ui/hooks/useHomeSession";
import { useMeshLoadHandlers } from "@/ui/hooks/useMeshLoadHandlers";
import { useViewportPreferences } from "@/ui/hooks/useViewportPreferences";
import { MeshViewport } from "@/viewer/MeshViewport";
import type {
  CutPolylineActions,
} from "@/viewer/cutPolyline/CutPolylineSession";
import type { CutPolylineFinalizeResult } from "@/viewer/cutPolyline/useCutPolylineDraft";

export default function HomePage() {
  const {
    mesh,
    seams,
    cutStrokes,
    meshLoadVersion,
    patternRevision,
    session,
    stats,
    isLoading,
    error,
    meshEditTool,
    toasts,
    loadMeshFile,
    toggleSeamAt,
    clearAllSeams,
    addCutStroke,
    updateCutStroke,
    deleteCutStroke,
    clearCutStrokes,
    setMeshEditTool,
    dismissToast,
    notifyToast,
  } = useHomeSession();

  const {
    flattenResult,
    flattening,
    includeSeamsInExport,
    setIncludeSeamsInExport,
    showQualityOverlay,
    setShowQualityOverlay,
    qualityCounts,
    onFlatten,
    onExportSvg,
  } = useFlattenExport(
    session,
    meshLoadVersion,
    patternRevision,
    cutStrokes,
    notifyToast,
  );

  const {
    wireframe,
    setWireframe,
    showGrid,
    setShowGrid,
    showAxes,
    setShowAxes,
    modelScale,
    setModelScale,
    resetModelScale,
  } = useViewportPreferences();
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("3d");
  const cutStrokeIdSeq = useRef(0);
  const [cutDraftActive, setCutDraftActive] = useState(false);
  const [cutDraftCanFinalize, setCutDraftCanFinalize] = useState(false);
  const [editingStrokeId, setEditingStrokeId] = useState<string | null>(null);
  const cutDraftActionsRef = useRef<CutPolylineActions | null>(null);

  const {
    isDesktop,
    sidebarOpen,
    toggleSidebar,
    closeSidebar,
    closeIfMobile,
    openButtonRef,
    sidebarDrawerId,
  } = useSidebarState();

  const { isPeeking, onPeekChange } = usePeekThrough();

  useEffect(() => {
    applyLayoutTokensToDocument();
  }, []);

  const viewportRef = useRef<HTMLElement | null>(null);
  const viewport3dPanelRef = useRef<HTMLDivElement | null>(null);
  const { split2dPx, isDragging, splitHandleProps } = useResizableSplit(viewportRef);

  const onBeforeMeshLoad = useCallback(() => {
    resetModelScale();
    setMobilePanel("3d");
  }, [resetModelScale]);

  const demo = useMeshLoadHandlers(loadMeshFile, notifyToast, onBeforeMeshLoad);

  const onEdgePick = useCallback(
    (edgeKey: Parameters<typeof toggleSeamAt>[0]) => {
      toggleSeamAt(edgeKey);
    },
    [toggleSeamAt],
  );

  const onDraftFinalize = useCallback(
    (result: CutPolylineFinalizeResult) => {
      if (result.kind === "update") {
        updateCutStroke(result.id, result.points);
        return;
      }
      cutStrokeIdSeq.current += 1;
      addCutStroke({
        id: `cut-${meshLoadVersion}-${cutStrokeIdSeq.current}`,
        points: result.points,
      });
    },
    [addCutStroke, meshLoadVersion, updateCutStroke],
  );

  const deleteLastCutStroke = useCallback(() => {
    const last = cutStrokes[cutStrokes.length - 1];
    if (!last) return;
    if (editingStrokeId === last.id) {
      cutDraftActionsRef.current?.cancel();
    }
    deleteCutStroke(last.id);
  }, [cutStrokes, deleteCutStroke, editingStrokeId]);

  const deleteEditingCutStroke = useCallback(() => {
    if (!editingStrokeId) return;
    const id = editingStrokeId;
    cutDraftActionsRef.current?.cancel();
    deleteCutStroke(id);
  }, [deleteCutStroke, editingStrokeId]);

  const onClearCutStrokes = useCallback(() => {
    cutDraftActionsRef.current?.cancel();
    clearCutStrokes();
  }, [clearCutStrokes]);

  const onCutDraftUiChange = useCallback(
    (ui: {
      active: boolean;
      canFinalize: boolean;
      editingStrokeId: string | null;
    }) => {
      setCutDraftActive(ui.active);
      setCutDraftCanFinalize(ui.canFinalize);
      setEditingStrokeId(ui.editingStrokeId);
    },
    [],
  );

  const onCutDraftDone = useCallback(() => {
    cutDraftActionsRef.current?.finalize();
  }, []);

  const onCutDraftCancel = useCallback(() => {
    cutDraftActionsRef.current?.cancel();
  }, []);

  const onCutPointCapReached = useCallback(() => {
    notifyToast("Cut stroke point limit (512) reached", "warning");
  }, [notifyToast]);

  const onCutFinalizeTooFewPoints = useCallback(() => {
    notifyToast("Place at least two points to finish the cut", "info");
  }, [notifyToast]);

  const handleFlatten = useCallback((): boolean => {
    const ok = onFlatten();
    if (ok && !isDesktop) {
      setMobilePanel("2d");
    }
    return ok;
  }, [isDesktop, onFlatten]);

  return (
    <AppLayout
      sidebarOpen={sidebarOpen}
      isDesktop={isDesktop}
      isPeeking={isPeeking}
      onCloseSidebar={closeSidebar}
      toasts={toasts}
      onDismissToast={dismissToast}
      sidebar={
        <AppSidebar
          layout={{
            sidebarOpen,
            sidebarDrawerId,
            openButtonRef,
            onToggleSidebar: toggleSidebar,
            onCloseSidebar: closeSidebar,
            closeIfMobile,
            peekEnabled: !isDesktop && sidebarOpen,
            isPeeking,
            onPeekChange,
          }}
          session={{
            session,
            stats,
            isLoading,
            error,
            meshEditTool,
            setMeshEditTool,
            clearAllSeams,
            cutStrokeCount: cutStrokes.length,
            clearCutStrokes: onClearCutStrokes,
            deleteLastCutStroke,
            deleteEditingCutStroke,
            editingStrokeId,
            cutDraftActive,
            cutDraftCanFinalize,
            onCutDraftDone,
            onCutDraftCancel,
          }}
          flatten={{
            flattening,
            flattenResult,
            qualityCounts,
            showQualityOverlay,
            setShowQualityOverlay,
            includeSeamsInExport,
            setIncludeSeamsInExport,
            onFlatten: handleFlatten,
            onExportSvg,
          }}
          view={{
            wireframe,
            setWireframe,
            showGrid,
            setShowGrid,
            showAxes,
            setShowAxes,
            modelScale,
            setModelScale,
          }}
          demo={{
            selectedDemoId: demo.selectedDemoId,
            setSelectedDemoId: demo.setSelectedDemoId,
            onPickFile: demo.loadMeshFromFile,
            onLoadDemo: demo.loadSelectedDemo,
          }}
        />
      }
    >
      <ViewportChrome
        containerRef={viewportRef}
        viewport3dPanelRef={viewport3dPanelRef}
        isDesktop={isDesktop}
        mobilePanel={mobilePanel}
        onMobilePanelChange={setMobilePanel}
        split2dPx={split2dPx}
        isDragging={isDragging}
        splitHandleProps={splitHandleProps}
        viewport3d={
          <>
            <MeshViewport
              mesh={mesh}
              seams={seams}
              cutStrokes={cutStrokes}
              meshLoadVersion={meshLoadVersion}
              viewportPanelRef={viewport3dPanelRef}
              wireframe={wireframe}
              showGrid={showGrid}
              showAxes={showAxes}
              modelScale={modelScale}
              editTool={meshEditTool}
              onEdgePick={onEdgePick}
              onDraftFinalize={onDraftFinalize}
              onCutDraftUiChange={onCutDraftUiChange}
              cutDraftActionsRef={cutDraftActionsRef}
              onCutPointCapReached={onCutPointCapReached}
              onCutFinalizeTooFewPoints={onCutFinalizeTooFewPoints}
            />
            {isLoading ? (
              <div className="overlay">
                <div className="card">
                  <div className="card-heading">Loading…</div>
                  <div className="muted">Parsing mesh file (UI thread)</div>
                </div>
              </div>
            ) : null}
            <CutDraftToolbar
              visible={meshEditTool === "cut" && cutDraftActive}
              canFinalize={cutDraftCanFinalize}
              editing={editingStrokeId != null}
              onDone={onCutDraftDone}
              onCancel={onCutDraftCancel}
            />
          </>
        }
        viewport2d={
          <UnfoldViewer2D
            result={flattenResult}
            showSeams={includeSeamsInExport}
            showQualityOverlay={showQualityOverlay}
            qualityCounts={qualityCounts}
          />
        }
      />
    </AppLayout>
  );
}
