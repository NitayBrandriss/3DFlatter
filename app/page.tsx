"use client";

import { useCallback, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  computeSessionStats,
  useMeshSessionStore,
} from "@/state/meshSessionStore";
import { ToastStack } from "@/ui/ToastStack";
import { UnfoldViewer2D } from "@/ui/UnfoldViewer2D";
import { useFlattenExport } from "@/ui/useFlattenExport";
import { MeshViewport } from "@/viewer/MeshViewport";

export default function HomePage() {
  const {
    session,
    meshLoadVersion,
    isLoading,
    error,
    seamMode,
    toasts,
    loadObjFile,
    toggleSeamAt,
    clearAllSeams,
    setSeamMode,
    dismissToast,
    notifyToast,
  } = useMeshSessionStore(
    useShallow((s) => ({
      session: s.session,
      meshLoadVersion: s.meshLoadVersion,
      isLoading: s.isLoading,
      error: s.error,
      seamMode: s.seamMode,
      toasts: s.toasts,
      loadObjFile: s.loadObjFile,
      toggleSeamAt: s.toggleSeamAt,
      clearAllSeams: s.clearAllSeams,
      setSeamMode: s.setSeamMode,
      dismissToast: s.dismissToast,
      notifyToast: s.notifyToast,
    })),
  );

  const stats = useMemo(() => computeSessionStats(session), [session]);

  const {
    flattenResult,
    flattening,
    includeSeamsInExport,
    setIncludeSeamsInExport,
    onFlatten,
    onExportSvg,
  } = useFlattenExport(session, notifyToast);

  const [wireframe, setWireframe] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(false);
  const [modelScale, setModelScale] = useState(1);

  const onPickFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setModelScale(1);
      await loadObjFile(file);
    },
    [loadObjFile],
  );

  const onEdgePick = useCallback(
    (edgeKey: Parameters<typeof toggleSeamAt>[0]) => {
      toggleSeamAt(edgeKey);
    },
    [toggleSeamAt],
  );

  return (
    <div className="page">
      <aside className="sidebar">
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>3D Flatter</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Upload an <code>.obj</code> and click edges to mark seams.
        </p>

        <div className="col">
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 10 }}>File</div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <input
                type="file"
                accept=".obj"
                disabled={isLoading}
                onChange={(e) => onPickFile(e.currentTarget.files?.[0] ?? null)}
              />
            </div>
            <div className="muted" style={{ marginTop: 10 }}>
              {session ? (
                <>
                  <div>
                    <span style={{ opacity: 0.8 }}>Loaded:</span> {session.fileName}
                  </div>
                  {stats ? (
                    <>
                      <div>
                        <span style={{ opacity: 0.8 }}>Stats:</span>{" "}
                        {stats.vertexCount.toLocaleString()} verts,{" "}
                        {stats.faceCount.toLocaleString()} tris
                      </div>
                      <div>
                        <span style={{ opacity: 0.8 }}>Edges:</span>{" "}
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
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Seams</div>

            <label className="toggle">
              <span className="muted">Seam mode</span>
              <input
                type="checkbox"
                checked={seamMode}
                disabled={!session}
                onChange={(e) => setSeamMode(e.currentTarget.checked)}
              />
            </label>

            <div className="muted" style={{ marginTop: 6 }}>
              {stats ? (
                <>
                  <div>
                    <span style={{ opacity: 0.8 }}>Selected:</span>{" "}
                    {stats.seamCount.toLocaleString()} seam
                    {stats.seamCount === 1 ? "" : "s"}
                  </div>
                  <div>
                    <span style={{ opacity: 0.8 }}>Islands:</span>{" "}
                    {stats.islandCount.toLocaleString()}
                    {stats.islandFaceCounts.length > 1 ? (
                      <span style={{ opacity: 0.75 }}>
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
              className="btn"
              style={{ marginTop: 10, width: "100%" }}
              disabled={!session || !stats || stats.seamCount === 0}
              onClick={clearAllSeams}
            >
              Clear seams
            </button>
          </div>

          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Flatten</div>
            <p className="muted" style={{ marginTop: 0, marginBottom: 10 }}>
              Unfold all islands into a 2D blueprint pattern.
            </p>
            <button
              type="button"
              className="btn"
              style={{ width: "100%" }}
              disabled={!session || flattening}
              onClick={onFlatten}
            >
              {flattening ? "Flattening…" : "Flatten"}
            </button>
          </div>

          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Export</div>
            <p className="muted" style={{ marginTop: 0, marginBottom: 10 }}>
              Download the flattened pattern as SVG (preview).
            </p>
            <label className="toggle">
              <span className="muted">Include seam overlay</span>
              <input
                type="checkbox"
                checked={includeSeamsInExport}
                disabled={!flattenResult}
                onChange={(e) => setIncludeSeamsInExport(e.currentTarget.checked)}
              />
            </label>
            <button
              type="button"
              className="btn"
              style={{ marginTop: 10, width: "100%" }}
              disabled={!flattenResult || !!flattenResult.error}
              onClick={onExportSvg}
            >
              Export SVG
            </button>
          </div>

          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 10 }}>View</div>

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
              <label className="col" style={{ marginTop: 4, gap: 6 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="muted">Model scale</span>
                  <span className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {modelScale.toFixed(2)}×
                  </span>
                </div>
                <input
                  type="range"
                  min={0.25}
                  max={3}
                  step={0.05}
                  value={modelScale}
                  onChange={(e) => setModelScale(Number(e.currentTarget.value))}
                  style={{ width: "100%" }}
                />
              </label>
            ) : null}
          </div>

          {error ? (
            <div className="card" style={{ borderColor: "rgba(255,70,70,0.35)" }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Error</div>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: 12,
                  color: "rgba(255, 220, 220, 0.95)",
                }}
              >
                {error}
              </pre>
            </div>
          ) : null}
        </div>
      </aside>

      <main className="viewport viewport-split">
        <div className="viewport-3d">
          <MeshViewport
            mesh={session?.mesh ?? null}
            seams={session?.seams ?? null}
            meshLoadVersion={meshLoadVersion}
            wireframe={wireframe}
            showGrid={showGrid}
            showAxes={showAxes}
            modelScale={modelScale}
            seamMode={seamMode}
            onEdgePick={onEdgePick}
          />

          <ToastStack toasts={toasts} onDismiss={dismissToast} />

          {isLoading ? (
            <div className="overlay">
              <div className="card">
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Loading…</div>
                <div className="muted">Parsing OBJ (UI thread)</div>
              </div>
            </div>
          ) : null}
        </div>

        <UnfoldViewer2D result={flattenResult} />
      </main>
    </div>
  );
}
