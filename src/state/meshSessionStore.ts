import { create } from "zustand";
import type { CutStroke, Vec3 } from "../logic/cuts/types";
import {
  formatByteLimit,
  MAX_MESH_FILE_BYTES,
} from "../logic/io/loadBudgets";
import { ObjParseError, parseObj } from "../logic/io/obj/parseObj";
import { parseStl, StlParseError } from "../logic/io/stl/parseStl";
import { buildTopology } from "../logic/mesh/buildTopology";
import { partitionIslands } from "../logic/mesh/partitionIslands";
import { summarizeTopology } from "../logic/mesh/topologyStats";
import type { EdgeKey, MeshModel, SeamRegistry, Topology } from "../logic/mesh/types";
import { canSelectAsSeam } from "../logic/seams/edgeEligibility";
import {
  clearSeams,
  createSeamRegistry,
  seamCount,
  toggleSeam,
} from "../logic/seams/seamRegistry";
import type { MeshEditTool } from "./meshEditTool";

export type { CutStroke, Vec3, MeshEditTool };

export type MeshSession = {
  mesh: MeshModel;
  topology: Topology;
  seams: SeamRegistry;
  fileName: string;
};

export type ToastMessage = {
  id: number;
  text: string;
  tone: "info" | "warning";
  /** Auto-dismiss delay in ms. Omitted → ToastStack default (4000). */
  duration?: number;
};

type MeshSessionState = {
  session: MeshSession | null;
  /** Bumps only on mesh load/clear — never on seam toggles or stroke edits. */
  meshLoadVersion: number;
  /**
   * Freeform cut overlay (ADR 0100). Canonical mesh-space polylines.
   * Does not mutate `session.mesh`. Cleared on successful file load.
   * Stroke CRUD no-ops when `session` is null.
   */
  cutStrokes: CutStroke[];
  /**
   * Bumps on cut-stroke CRUD only. Used with `meshLoadVersion` and
   * `seamsContentKey` for flatten snapshot identity (ADR 0100).
   * Seam toggles do not bump this — seams enter the fingerprint via content key.
   */
  patternRevision: number;
  isLoading: boolean;
  error: string | null;
  /** Edge-pick seams, freeform draw cut, or orbit-only. */
  meshEditTool: MeshEditTool;
  toasts: ToastMessage[];
  toastSeq: number;

  loadMeshFile: (file: File) => Promise<boolean>;
  toggleSeamAt: (edgeKey: EdgeKey) => void;
  clearAllSeams: () => void;
  addCutStroke: (stroke: CutStroke) => void;
  updateCutStroke: (id: string, points: readonly Vec3[]) => void;
  deleteCutStroke: (id: string) => void;
  clearCutStrokes: () => void;
  setMeshEditTool: (tool: MeshEditTool) => void;
  dismissToast: (id: number) => void;
  notifyToast: (text: string, tone?: ToastMessage["tone"]) => void;
};

/**
 * Flatten snapshot key (ADR 0100): mesh load + stroke revision + seams fingerprint.
 * Seam edits change `seamsKey` without bumping `patternRevision` / `meshLoadVersion`.
 */
export function flattenSnapshotKey(
  meshLoadVersion: number,
  patternRevision: number,
  seamsKey: string,
): string {
  return `${meshLoadVersion}:${patternRevision}:${seamsKey}`;
}

function cloneStrokePoints(points: readonly Vec3[]): Vec3[] {
  return points.map((p) => ({ ...p }));
}

function pushToast(
  state: MeshSessionState,
  text: string,
  tone: ToastMessage["tone"],
  duration?: number,
): Pick<MeshSessionState, "toasts" | "toastSeq"> {
  const id = state.toastSeq + 1;
  const toast: ToastMessage = { id, text, tone };
  if (duration != null) toast.duration = duration;
  const toasts = [...state.toasts, toast].slice(-4);
  return { toasts, toastSeq: id };
}

const LOAD_ERROR_TOAST_MAX = 120;

/** Load/parse failures stay on screen long enough to read the parser message. */
export const LOAD_ERROR_TOAST_DURATION_MS = 20_000;

/** Prominent toast copy for failed loads (HOLISTIC-UI-004). Sidebar keeps full `error`. */
export function formatLoadErrorToast(message: string): string {
  const prefix = "Could not load mesh: ";
  const body = message.trim() || "Unknown error";
  const full = `${prefix}${body}`;
  if (full.length <= LOAD_ERROR_TOAST_MAX) return full;
  return `${full.slice(0, LOAD_ERROR_TOAST_MAX - 1)}…`;
}

function applyLoadWarnings(
  state: MeshSessionState,
  warnings: { kind: string; count?: number }[],
  skippedDegenerateFaceCount = 0,
): Pick<MeshSessionState, "toasts" | "toastSeq"> {
  let next = state;

  const concaveCount = warnings.filter((w) => w.kind === "concave_ngon").length;
  if (concaveCount > 0) {
    next = {
      ...next,
      ...pushToast(
        next,
        concaveCount === 1
          ? "Warning: 1 concave face detected. Topology may be invalid."
          : `Warning: ${concaveCount} concave faces detected. Topology may be invalid.`,
        "warning",
      ),
    };
  }

  const degenerateCount = warnings.reduce((sum, w) => {
    if (w.kind !== "degenerate_triangle") return sum;
    return sum + (typeof w.count === "number" ? w.count : 1);
  }, 0);
  if (degenerateCount > 0) {
    next = {
      ...next,
      ...pushToast(
        next,
        degenerateCount === 1
          ? "Warning: 1 degenerate triangle detected and skipped."
          : `Warning: ${degenerateCount} degenerate triangles detected and skipped.`,
        "warning",
      ),
    };
  }

  if (skippedDegenerateFaceCount > 0) {
    next = {
      ...next,
      ...pushToast(
        next,
        skippedDegenerateFaceCount === 1
          ? "Warning: 1 index-degenerate face skipped in topology."
          : `Warning: ${skippedDegenerateFaceCount} index-degenerate faces skipped in topology.`,
        "warning",
      ),
    };
  }

  return { toasts: next.toasts, toastSeq: next.toastSeq };
}

function computeIslands(session: MeshSession) {
  return partitionIslands(session.mesh, session.topology, session.seams);
}

/**
 * Stable fingerprint of seam set contents (order-independent).
 * Use for memo deps so a new `SeamRegistry`/`Set` with the same keys does not
 * re-run `partitionIslands` (STATE-003).
 */
export function seamsContentKey(seams: SeamRegistry): string {
  if (seams.seams.size === 0) return "";
  return [...seams.seams].sort().join("\0");
}

/** Monotonic load generation — module-scoped so overlapping async loads stay ordered.
 * Only the latest load may commit session / clear isLoading (STATE-001 / STATE-008). */
let loadSeq = 0;

export const useMeshSessionStore = create<MeshSessionState>((set, get) => ({
  session: null,
  meshLoadVersion: 0,
  cutStrokes: [],
  patternRevision: 0,
  isLoading: false,
  error: null,
  meshEditTool: "seam",
  toasts: [],
  toastSeq: 0,

  loadMeshFile: async (file: File) => {
    const myId = ++loadSeq;
    set({ isLoading: true, error: null });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    try {
      if (file.size > MAX_MESH_FILE_BYTES) {
        throw new Error(
          `File too large (${formatByteLimit(file.size)}). Soft limit is ${formatByteLimit(MAX_MESH_FILE_BYTES)}.`,
        );
      }

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const buffer = await file.arrayBuffer();

      let mesh;
      let warnings: { kind: string; count?: number }[] = [];

      if (ext === "obj") {
        const text = new TextDecoder("utf-8").decode(buffer);
        const result = parseObj(text);
        mesh = result.mesh;
        warnings = result.warnings;
      } else if (ext === "stl") {
        const result = parseStl(buffer);
        mesh = result.mesh;
        warnings = result.warnings;
      } else {
        throw new Error(`Unsupported file type ".${ext || "?"}" — use .obj or .stl`);
      }

      if (myId !== loadSeq) {
        return false;
      }

      const topology = buildTopology(mesh);
      const session: MeshSession = {
        mesh,
        topology,
        seams: createSeamRegistry(),
        fileName: file.name,
      };
      const hasLoadWarnings =
        warnings.some(
          (w) => w.kind === "concave_ngon" || w.kind === "degenerate_triangle",
        ) || topology.skippedDegenerateFaceCount > 0;
      set((s) => ({
        session,
        meshLoadVersion: s.meshLoadVersion + 1,
        cutStrokes: [],
        patternRevision: 0,
        isLoading: false,
        error: null,
        ...(hasLoadWarnings
          ? applyLoadWarnings(s, warnings, topology.skippedDegenerateFaceCount)
          : {}),
      }));
      return true;
    } catch (e) {
      const message =
        e instanceof ObjParseError || e instanceof StlParseError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e);
      if (myId !== loadSeq) {
        return false;
      }
      // Keep prior session; do not bump meshLoadVersion (STATE-007 / STATE-004).
      set((s) => ({
        isLoading: false,
        error: message,
        ...pushToast(
          s,
          formatLoadErrorToast(message),
          "warning",
          LOAD_ERROR_TOAST_DURATION_MS,
        ),
      }));
      return false;
    }
  },

  toggleSeamAt: (edgeKey: EdgeKey) => {
    const { session } = get();
    if (!session) return;

    const eligibility = canSelectAsSeam(session.topology, edgeKey);
    if (!eligibility.ok) {
      set((s) => ({
        ...pushToast(s, eligibility.reason, "warning"),
      }));
      return;
    }

    const nextSeams = toggleSeam(session.seams, edgeKey);
    set({
      session: { ...session, seams: nextSeams },
    });
  },

  clearAllSeams: () => {
    const { session } = get();
    if (!session || session.seams.seams.size === 0) return;
    set({
      session: { ...session, seams: clearSeams(session.seams) },
    });
  },

  addCutStroke: (stroke: CutStroke) => {
    if (!get().session || stroke.points.length < 2) return;
    const cloned: CutStroke = {
      ...stroke,
      points: cloneStrokePoints(stroke.points),
    };
    set((s) => {
      const idx = s.cutStrokes.findIndex((c) => c.id === stroke.id);
      if (idx >= 0) {
        const next = s.cutStrokes.slice();
        next[idx] = cloned;
        return { cutStrokes: next, patternRevision: s.patternRevision + 1 };
      }
      return {
        cutStrokes: [...s.cutStrokes, cloned],
        patternRevision: s.patternRevision + 1,
      };
    });
  },

  updateCutStroke: (id: string, points: readonly Vec3[]) => {
    if (!get().session || points.length < 2) return;
    set((s) => {
      const idx = s.cutStrokes.findIndex((c) => c.id === id);
      if (idx < 0) return s;
      const next = s.cutStrokes.slice();
      const prev = next[idx]!;
      next[idx] = { ...prev, points: cloneStrokePoints(points) };
      return { cutStrokes: next, patternRevision: s.patternRevision + 1 };
    });
  },

  deleteCutStroke: (id: string) => {
    if (!get().session) return;
    set((s) => {
      if (!s.cutStrokes.some((c) => c.id === id)) return s;
      return {
        cutStrokes: s.cutStrokes.filter((c) => c.id !== id),
        patternRevision: s.patternRevision + 1,
      };
    });
  },

  clearCutStrokes: () => {
    set((s) => {
      if (s.cutStrokes.length === 0) return s;
      return { cutStrokes: [], patternRevision: s.patternRevision + 1 };
    });
  },

  setMeshEditTool: (tool: MeshEditTool) => set({ meshEditTool: tool }),

  dismissToast: (id: number) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  notifyToast: (text: string, tone: ToastMessage["tone"] = "info") =>
    set((s) => pushToast(s, text, tone)),
}));

export type SessionStats = {
  vertexCount: number;
  faceCount: number;
  boundaryEdgesCount: number;
  manifoldEdgesCount: number;
  nonManifoldEdgesCount: number;
  skippedDegenerateFaceCount: number;
  seamCount: number;
  islandCount: number;
  islandFaceCounts: number[];
};

/**
 * Pure derived stats — call from useMemo keyed on mesh identity + `seamsContentKey`,
 * not whole `session` object identity (STATE-003). Do not use as a Zustand selector.
 *
 * Island partition runs only when mesh, topology, or seam *contents* change.
 */
export function computeSessionStats(
  session: MeshSession | null,
): SessionStats | null {
  if (!session) return null;

  const islands = computeIslands(session);
  const edgeSummary = summarizeTopology(session.topology);

  return {
    vertexCount: session.mesh.vertexCount,
    faceCount: session.mesh.faceCount,
    ...edgeSummary,
    skippedDegenerateFaceCount: session.topology.skippedDegenerateFaceCount,
    seamCount: seamCount(session.seams),
    islandCount: islands.length,
    islandFaceCounts: islands.map((isl) => isl.length),
  };
}
