export default function HomePage() {
  return (
    <div className="page">
      <aside className="sidebar">
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>OBJ Viewer (WIP)</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Next up: upload + parse OBJ into MeshModel.
        </p>

        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Controls</div>
          <div className="muted">
            Placeholder UI (wireframe/grid/axes/loading) will land once the OBJ
            parser is in place.
          </div>
        </div>
      </aside>

      <main className="viewport">
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
          }}
        >
          <div className="muted">Viewport placeholder</div>
        </div>
      </main>
    </div>
  );
}

