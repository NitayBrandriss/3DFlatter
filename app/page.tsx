"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  computeSessionStats,
  seamsContentKey,
  useMeshSessionStore,
  type MeshSession,
} from "@/state/meshSessionStore";
import { applyLayoutTokensToDocument } from "@/ui/layout/applyLayoutTokens";
import { AppSidebar } from "@/ui/layout/AppSidebar";
import { usePeekThrough } from "@/ui/layout/usePeekThrough";
import { useResizableSplit } from "@/ui/layout/useResizableSplit";
import { useSidebarState } from "@/ui/layout/useSidebarState";
import { ViewportChrome } from "@/ui/layout/ViewportChrome";
import type { MobilePanel } from "@/ui/layout/ViewportChrome";
import { ToastStack } from "@/ui/ToastStack";
import { UnfoldViewer2D } from "@/ui/UnfoldViewer2D";
import { useFlattenExport } from "@/ui/useFlattenExport";
import { MeshViewport } from "@/viewer/MeshViewport";
import { DEMO_MODELS } from "@/ui/demoModels";

export default function HomePage() {
  // ARCH-001: mesh identity vs seams vs chrome vs actions — seam toggles do not
  // invalidate meshLoadVersion / mesh / topology subscriptions.
  const meshIdentity = useMeshSessionStore(
    useShallow((s) => ({
      mesh: s.session?.mesh ?? null,
      topology: s.session?.topology ?? null,
      fileName: s.session?.fileName ?? null,
      meshLoadVersion: s.meshLoadVersion,
    })),
  );
  const seams = useMeshSessionStore((s) => s.session?.seams ?? null);
  const chrome = useMeshSessionStore(
    useShallow((s) => ({
      isLoading: s.isLoading,
      error: s.error,
      seamMode: s.seamMode,
      toasts: s.toasts,
    })),
  );
  const actions = useMeshSessionStore(
    useShallow((s) => ({
      loadMeshFile: s.loadMeshFile,
      toggleSeamAt: s.toggleSeamAt,
      clearAllSeams: s.clearAllSeams,
      setSeamMode: s.setSeamMode,
      dismissToast: s.dismissToast,
      notifyToast: s.notifyToast,
    })),
  );

  const { mesh, topology, fileName, meshLoadVersion } = meshIdentity;
  const { isLoading, error, seamMode, toasts } = chrome;
  const {
    loadMeshFile,
    toggleSeamAt,
    clearAllSeams,
    setSeamMode,
    dismissToast,
    notifyToast,
  } = actions;

  const session = useMemo((): MeshSession | null => {
    if (!mesh || !topology || !seams || fileName == null) return null;
    return { mesh, topology, seams, fileName };
  }, [mesh, topology, seams, fileName]);

  // STATE-003: partition only when mesh/topology or seam *contents* change —
  // not when a new SeamRegistry/`Set` has the same keys.
  const seamsKey = seams ? seamsContentKey(seams) : null;
  const stats = useMemo(() => {
    if (!mesh || !topology || !seams || fileName == null) return null;
    return computeSessionStats({ mesh, topology, seams, fileName });
    // `seams` omitted on purpose: `seamsKey` is the content equality gate.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- STATE-003
  }, [mesh, topology, seamsKey, fileName]);

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
  } = useFlattenExport(session, meshLoadVersion, notifyToast);

  const [wireframe, setWireframe] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(false);
  const [modelScale, setModelScale] = useState(1);
  const [selectedDemoId, setSelectedDemoId] = useState(DEMO_MODELS[0]?.id ?? "");
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

  const resetViewAfterMeshLoad = useCallback(() => {
    setModelScale(1);
    setMobilePanel("3d");
  }, []);

  const onPickFile = useCallback(
    async (file: File | null): Promise<boolean> => {
      if (!file) return false;
      resetViewAfterMeshLoad();
      return loadMeshFile(file);
    },
    [loadMeshFile, resetViewAfterMeshLoad],
  );

  const onLoadDemo = useCallback(async (): Promise<boolean> => {
    const demo = DEMO_MODELS.find((model) => model.id === selectedDemoId);
    if (!demo) return false;

    resetViewAfterMeshLoad();
    const response = await fetch(`/api/demo-models/${demo.id}`);
    if (!response.ok) {
      notifyToast(
        response.status === 404
          ? `Demo model "${demo.label}" not found. Add it under 3d_models/.`
          : `Failed to load demo model "${demo.label}".`,
        "warning",
      );
      return false;
    }

    const blob = await response.blob();
    const file = new File([blob], demo.fileName, { type: blob.type });
    return loadMeshFile(file);
  }, [loadMeshFile, notifyToast, resetViewAfterMeshLoad, selectedDemoId]);

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

  const showMobileBackdrop = !isDesktop && sidebarOpen && !isPeeking;

  return (
    <div
      className="page"
      data-sidebar={sidebarOpen ? "open" : "collapsed"}
      data-sidebar-peek={isPeeking ? "true" : "false"}
    >
      {showMobileBackdrop ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close menu"
          onClick={closeSidebar}
        />
      ) : null}

      <AppSidebar
        sidebarOpen={sidebarOpen}
        sidebarDrawerId={sidebarDrawerId}
        openButtonRef={openButtonRef}
        onToggleSidebar={toggleSidebar}
        onCloseSidebar={closeSidebar}
        closeIfMobile={closeIfMobile}
        peekEnabled={!isDesktop && sidebarOpen}
        isPeeking={isPeeking}
        onPeekChange={onPeekChange}
        session={session}
        stats={stats}
        isLoading={isLoading}
        error={error}
        seamMode={seamMode}
        setSeamMode={setSeamMode}
        clearAllSeams={clearAllSeams}
        flattening={flattening}
        flattenResult={flattenResult}
        qualityCounts={qualityCounts}
        showQualityOverlay={showQualityOverlay}
        setShowQualityOverlay={setShowQualityOverlay}
        includeSeamsInExport={includeSeamsInExport}
        setIncludeSeamsInExport={setIncludeSeamsInExport}
        onPickFile={onPickFile}
        onLoadDemo={onLoadDemo}
        onFlatten={handleFlatten}
        onExportSvg={onExportSvg}
        wireframe={wireframe}
        setWireframe={setWireframe}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        showAxes={showAxes}
        setShowAxes={setShowAxes}
        modelScale={modelScale}
        setModelScale={setModelScale}
        selectedDemoId={selectedDemoId}
        setSelectedDemoId={setSelectedDemoId}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

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
    </div>
  );
}
