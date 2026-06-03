"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { MeshModel } from "../src/logic/mesh/types";
import { parseObj, ObjParseError } from "../src/logic/io/obj/parseObj";
import { MeshViewport } from "../src/viewer/MeshViewport";

function nextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export default function HomePage() {
  const meshRef = useRef<MeshModel | null>(null);
  const [meshVersion, setMeshVersion] = useState(0);

  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [wireframe, setWireframe] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(false);
  const [modelScale, setModelScale] = useState(1);

  const stats = useMemo(() => {
    const m = meshRef.current;
    if (!m) return null;
    return { vertexCount: m.vertexCount, faceCount: m.faceCount };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meshVersion]);

  const onPickFile = useCallback(
    async (file: File | null) => {
      setError(null);
      if (!file) return;
      setFileName(file.name);

      // Ensure the UI visibly enters a Loading state before parsing blocks the thread.
      setIsLoading(true);
      await nextPaint();
      await nextPaint();

      try {
        const text = await file.text();
        const mesh = parseObj(text);
        meshRef.current = mesh;
        setModelScale(1);
        setMeshVersion((v) => v + 1);
      } catch (e) {
        meshRef.current = null;
        setMeshVersion((v) => v + 1);
        if (e instanceof ObjParseError) setError(e.message);
        else if (e instanceof Error) setError(e.message);
        else setError(String(e));
      } finally {
        setIsLoading(false);
      }
    },
    [setMeshVersion],
  );

  return (
    <div className="page">
      <aside className="sidebar">
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>OBJ Viewer</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Upload an <code>.obj</code> (v/f only in v1).
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
              {fileName ? (
                <>
                  <div>
                    <span style={{ opacity: 0.8 }}>Loaded:</span> {fileName}
                  </div>
                  {stats ? (
                    <div>
                      <span style={{ opacity: 0.8 }}>Stats:</span>{" "}
                      {stats.vertexCount.toLocaleString()} verts,{" "}
                      {stats.faceCount.toLocaleString()} tris
                    </div>
                  ) : null}
                </>
              ) : (
                "No file loaded."
              )}
            </div>
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

      <main className="viewport">
        <MeshViewport
          meshRef={meshRef}
          meshVersion={meshVersion}
          wireframe={wireframe}
          showGrid={showGrid}
          showAxes={showAxes}
          modelScale={modelScale}
        />

        {isLoading ? (
          <div className="overlay">
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Loading…</div>
              <div className="muted">Parsing OBJ (UI thread)</div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

