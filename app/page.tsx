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
import { UnfoldViewer2D } from "@/ui/UnfoldViewer2D";
import { useFlattenExport } from "@/ui/useFlattenExport";
import { useHomeSession } from "@/ui/hooks/useHomeSession";
import { useMeshLoadHandlers } from "@/ui/hooks/useMeshLoadHandlers";
import { useViewportPreferences } from "@/ui/hooks/useViewportPreferences";
import { MeshViewport } from "@/viewer/MeshViewport";

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
    seamMode,
    toasts,
    loadMeshFile,
    toggleSeamAt,
    clearAllSeams,
    setSeamMode,
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
            seamMode,
            setSeamMode,
            clearAllSeams,
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
              meshLoadVersion={meshLoadVersion}
              viewportPanelRef={viewport3dPanelRef}
              wireframe={wireframe}
              showGrid={showGrid}
              showAxes={showAxes}
              modelScale={modelScale}
              seamMode={seamMode}
              onEdgePick={onEdgePick}
            />
            {isLoading ? (
              <div className="overlay">
                <div className="card">
                  <div className="card-heading">Loading…</div>
                  <div className="muted">Parsing mesh file (UI thread)</div>
                </div>
              </div>
            ) : null}
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
