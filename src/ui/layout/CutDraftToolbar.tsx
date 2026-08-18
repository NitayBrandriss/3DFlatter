"use client";

type CutDraftToolbarProps = {
  visible: boolean;
  canFinalize: boolean;
  editing: boolean;
  onDone: () => void;
  onCancel: () => void;
};

/** HTML overlay on the 3D viewport — not inside the R3F Canvas (HOLISTIC-UI-001). */
export function CutDraftToolbar({
  visible,
  canFinalize,
  editing,
  onDone,
  onCancel,
}: CutDraftToolbarProps) {
  if (!visible) return null;

  return (
    <div className="cut-draft-toolbar" role="toolbar" aria-label="Cut draft">
      <span className="cut-draft-toolbar-label">
        {editing ? "Editing cut" : "Drawing cut"}
      </span>
      <button
        type="button"
        className="btn"
        onClick={onDone}
        disabled={!canFinalize}
      >
        Done
      </button>
      <button type="button" className="btn" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
