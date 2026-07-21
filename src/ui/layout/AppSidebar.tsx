"use client";

import type { RefObject } from "react";
import type { UnfoldMeshResult } from "@/logic/mesh/types";
import {
  formatQualityIssueSummary,
  type QualityIssueCounts,
} from "@/logic/unfold/qualitySummary";
import type { MeshSession } from "@/state/meshSessionStore";
import type { computeSessionStats } from "@/state/meshSessionStore";
import { DEMO_MODELS } from "@/ui/demoModels";
import { PeekThroughControl } from "./PeekThroughControl";

type SessionStats = ReturnType<typeof computeSessionStats>;

export type AppSidebarProps = {
  sidebarOpen: boolean;
  sidebarDrawerId: string;
  openButtonRef: RefObject<HTMLButtonElement | null>;
  onToggleSidebar: () => void;
  onCloseSidebar: () => void;
  closeIfMobile: () => void;
  peekEnabled: boolean;
  isPeeking: boolean;
  onPeekChange: (next: boolean) => void;
  session: MeshSession | null;
  stats: SessionStats;
  isLoading: boolean;
  error: string | null;
  seamMode: boolean;
  setSeamMode: (enabled: boolean) => void;
  clearAllSeams: () => void;
  flattening: boolean;
  flattenResult: UnfoldMeshResult | null;
  qualityCounts: QualityIssueCounts | null;
  showQualityOverlay: boolean;
  setShowQualityOverlay: (value: boolean) => void;
  includeSeamsInExport: boolean;
  setIncludeSeamsInExport: (value: boolean) => void;
  onPickFile: (file: File | null) => Promise<boolean>;
  onLoadDemo: () => Promise<boolean>;
  onFlatten: () => boolean;
  onExportSvg: () => void;
  wireframe: boolean;
  setWireframe: (value: boolean) => void;
  showGrid: boolean;
  setShowGrid: (value: boolean) => void;
  showAxes: boolean;
  setShowAxes: (value: boolean) => void;
  modelScale: number;
  setModelScale: (value: number) => void;
  selectedDemoId: string;
  setSelectedDemoId: (value: string) => void;
};

export function AppSidebar({
  sidebarOpen,
  sidebarDrawerId,
  openButtonRef,
  onToggleSidebar,
  onCloseSidebar,
  closeIfMobile,
  peekEnabled,
  isPeeking,
  onPeekChange,
  session,
  stats,
  isLoading,
  error,
  seamMode,
  setSeamMode,
  clearAllSeams,
  flattening,
  flattenResult,
  qualityCounts,
  showQualityOverlay,
  setShowQualityOverlay,
  includeSeamsInExport,
  setIncludeSeamsInExport,
  onPickFile,
  onLoadDemo,
  onFlatten,
  onExportSvg,
  wireframe,
  setWireframe,
  showGrid,
  setShowGrid,
  showAxes,
  setShowAxes,
  modelScale,
  setModelScale,
  selectedDemoId,
  setSelectedDemoId,
}: AppSidebarProps) {
  const handlePickFile = async (file: File | null) => {
    const ok = await onPickFile(file);
    if (ok) {
      closeIfMobile();
    }
  };

  const handleLoadDemo = async () => {
    const ok = await onLoadDemo();
    if (ok) {
      closeIfMobile();
    }
  };

  const handleFlatten = () => {
    const ok = onFlatten();
    if (ok) {
      closeIfMobile();
    }
  };

  return (
    <aside className="sidebar" aria-label="App controls">
      <div className="sidebar-rail">
        <h2 className="sidebar-title">3D Flatter</h2>
        {!sidebarOpen ? (
          <button
            ref={openButtonRef}
            type="button"
            className="sidebar-toggle sidebar-toggle--open btn"
            aria-expanded={false}
            aria-controls={sidebarDrawerId}
            aria-label="Open menu"
            onClick={onToggleSidebar}
          >
            <span className="sidebar-toggle-icon" aria-hidden>
              ›
            </span>
            <span className="sidebar-toggle-label">Menu</span>
          </button>
        ) : null}
      </div>

      <div className="sidebar-drawer" id={sidebarDrawerId}>
        {sidebarOpen ? (
          <button
            type="button"
            className="sidebar-toggle sidebar-toggle--close btn"
            aria-expanded={true}
            aria-controls={sidebarDrawerId}
            aria-label="Close menu"
            onClick={onCloseSidebar}
          >
            <span className="sidebar-toggle-icon" aria-hidden>
              ‹
            </span>
            <span className="sidebar-toggle-label">Close</span>
          </button>
        ) : null}

        <div className="sidebar-drawer-body">
          <p className="sidebar-intro muted">
            Upload an <code>.obj</code> or <code>.stl</code> and click edges to mark seams.
          </p>

          <div className="col sidebar-cards">
          <div className="card">
            <div className="card-heading">File</div>
            <div className="row row--spread">
              <input
                className="sidebar-file-input"
                type="file"
                accept=".obj,.stl"
                disabled={isLoading}
                onChange={(e) => void handlePickFile(e.currentTarget.files?.[0] ?? null)}
              />
            </div>

            <div className="col col--tight" style={{ marginTop: 10 }}>
              <div className="muted sidebar-hint">Or load a local demo model:</div>
              <div className="row">
                <select
                  className="select"
                  value={selectedDemoId}
                  disabled={isLoading}
                  onChange={(e) => setSelectedDemoId(e.currentTarget.value)}
                  aria-label="Demo model"
                >
                  {DEMO_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn"
                  disabled={isLoading || !selectedDemoId}
                  onClick={() => void handleLoadDemo()}
                >
                  Load demo
                </button>
              </div>
            </div>
            <div className="muted sidebar-meta">
              {session ? (
                <>
                  <div>
                    <span className="sidebar-meta-label">Loaded:</span> {session.fileName}
                  </div>
                  {stats ? (
                    <>
                      <div>
                        <span className="sidebar-meta-label">Stats:</span>{" "}
                        {stats.vertexCount.toLocaleString()} verts,{" "}
                        {stats.faceCount.toLocaleString()} tris
                      </div>
                      <div>
                        <span className="sidebar-meta-label">Edges:</span>{" "}
                        {stats.manifoldEdgesCount.toLocaleString()} manifold,{" "}
                        {stats.boundaryEdgesCount.toLocaleString()} boundary,{" "}
                        {stats.nonManifoldEdgesCount.toLocaleString()} non-manifold
                        {stats.skippedDegenerateFaceCount > 0
                          ? ` (${stats.skippedDegenerateFaceCount} degenerate faces skipped)`
                          : null}
                      </div>
                    </>
                  ) : null}
                </>
              ) : (
                "No file loaded."
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-heading">Seams</div>

            <label className="toggle">
              <span className="muted">Seam mode</span>
              <input
                type="checkbox"
                checked={seamMode}
                disabled={!session}
                onChange={(e) => setSeamMode(e.currentTarget.checked)}
              />
            </label>

            <div className="muted sidebar-meta-tight">
              {stats ? (
                <>
                  <div>
                    <span className="sidebar-meta-label">Selected:</span>{" "}
                    {stats.seamCount.toLocaleString()} seam
                    {stats.seamCount === 1 ? "" : "s"}
                  </div>
                  <div>
                    <span className="sidebar-meta-label">Islands:</span>{" "}
                    {stats.islandCount.toLocaleString()}
                    {stats.islandFaceCounts.length > 1 ? (
                      <span className="sidebar-meta-secondary">
                        {" "}
                        ({stats.islandFaceCounts.join(" / ")} faces)
                      </span>
                    ) : null}
                  </div>
                </>
              ) : (
                "Load a mesh to select seams."
              )}
            </div>

            <button
              type="button"
              className="btn btn--block"
              disabled={!session || !stats || stats.seamCount === 0}
              onClick={clearAllSeams}
            >
              Clear seams
            </button>
          </div>

          <div className="card">
            <div className="card-heading">Flatten</div>
            <p className="muted card-copy">
              Unfold all islands into a 2D blueprint pattern.
            </p>
            <button
              type="button"
              className="btn btn--block"
              disabled={!session || flattening}
              onClick={handleFlatten}
            >
              {flattening ? "Flattening…" : "Flatten"}
            </button>
            {qualityCounts?.hasIssues ? (
              <div className="muted sidebar-meta-tight">
                {formatQualityIssueSummary(qualityCounts)}
              </div>
            ) : null}
            <label className="toggle">
              <span className="muted">Show quality overlay</span>
              <input
                type="checkbox"
                checked={showQualityOverlay}
                disabled={!flattenResult || !qualityCounts?.hasIssues}
                onChange={(e) => setShowQualityOverlay(e.currentTarget.checked)}
              />
            </label>
          </div>

          <div className="card">
            <div className="card-heading">Export</div>
            <p className="muted card-copy">
              Download the flattened pattern as SVG (preview). Seam overlay
              visibility matches the 2D viewer.
            </p>
            <label className="toggle">
              <span className="muted">Show seam overlay</span>
              <input
                type="checkbox"
                checked={includeSeamsInExport}
                disabled={!flattenResult}
                onChange={(e) => setIncludeSeamsInExport(e.currentTarget.checked)}
              />
            </label>
            <button
              type="button"
              className="btn btn--block"
              disabled={!flattenResult || !!flattenResult.error}
              onClick={onExportSvg}
            >
              Export SVG
            </button>
          </div>

          <div className="card">
            <div className="card-heading">View</div>

            <label className="toggle">
              <span className="muted">Grid</span>
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.currentTarget.checked)}
              />
            </label>
            <label className="toggle">
              <span className="muted">Axes</span>
              <input
                type="checkbox"
                checked={showAxes}
                onChange={(e) => setShowAxes(e.currentTarget.checked)}
              />
            </label>
            <label className="toggle">
              <span className="muted">Wireframe</span>
              <input
                type="checkbox"
                checked={wireframe}
                onChange={(e) => setWireframe(e.currentTarget.checked)}
              />
            </label>

            {stats ? (
              <PeekThroughControl
                enabled={peekEnabled}
                isPeeking={isPeeking}
                onPeekChange={onPeekChange}
              >
                <label className="col col--scale">
                  <div className="row row--spread">
                    <span className="muted">Model scale</span>
                    <span className="muted tabular-nums">{modelScale.toFixed(2)}×</span>
                  </div>
                  <input
                    type="range"
                    className="sidebar-range"
                    min={0.25}
                    max={3}
                    step={0.05}
                    value={modelScale}
                    onChange={(e) => setModelScale(Number(e.currentTarget.value))}
                  />
                </label>
              </PeekThroughControl>
            ) : null}
          </div>

          {error ? (
            <div className="card card--error">
              <div className="card-heading">Error</div>
              <pre className="sidebar-error">{error}</pre>
            </div>
          ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
