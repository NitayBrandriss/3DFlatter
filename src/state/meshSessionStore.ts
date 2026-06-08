import { create } from "zustand";
import { ObjParseError, parseObj } from "../logic/io/obj/parseObj";
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
};

type MeshSessionState = {
  session: MeshSession | null;
  /** Bumps only on mesh load/clear — never on seam toggles. */
  meshLoadVersion: number;
  isLoading: boolean;
  error: string | null;
  seamMode: boolean;
  toasts: ToastMessage[];
  toastSeq: number;

  loadObjFile: (file: File) => Promise<void>;
  toggleSeamAt: (edgeKey: EdgeKey) => void;
  clearAllSeams: () => void;
  setSeamMode: (enabled: boolean) => void;
  dismissToast: (id: number) => void;
};

function pushToast(
  state: MeshSessionState,
  text: string,
  tone: ToastMessage["tone"],
): Pick<MeshSessionState, "toasts" | "toastSeq"> {
  const id = state.toastSeq + 1;
  const toast: ToastMessage = { id, text, tone };
  const toasts = [...state.toasts, toast].slice(-4);
  return { toasts, toastSeq: id };
}

function computeIslands(session: MeshSession) {
  return partitionIslands(session.mesh, session.topology, session.seams);
}

export const useMeshSessionStore = create<MeshSessionState>((set, get) => ({
  session: null,
  meshLoadVersion: 0,
  isLoading: false,
  error: null,
  seamMode: true,
  toasts: [],
  toastSeq: 0,

  loadObjFile: async (file: File) => {
    set({ isLoading: true, error: null });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    try {
      const text = await file.text();
      const mesh = parseObj(text);
      const topology = buildTopology(mesh);
      const session: MeshSession = {
        mesh,
        topology,
        seams: createSeamRegistry(),
        fileName: file.name,
      };
      set((s) => ({
        session,
        meshLoadVersion: s.meshLoadVersion + 1,
        isLoading: false,
        error: null,
      }));
    } catch (e) {
      const message =
        e instanceof ObjParseError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e);
      set((s) => ({
        session: null,
        meshLoadVersion: s.meshLoadVersion + 1,
        isLoading: false,
        error: message,
      }));
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
    if (!session) return;
    set({
      session: { ...session, seams: clearSeams(session.seams) },
    });
  },

  setSeamMode: (enabled: boolean) => set({ seamMode: enabled }),

  dismissToast: (id: number) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
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

/** Pure derived stats — call from useMemo keyed on `session`, not as a Zustand selector. */
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
