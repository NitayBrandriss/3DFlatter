"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  computeSessionStats,
  seamsContentKey,
  useMeshSessionStore,
  type MeshSession,
} from "@/state/meshSessionStore";

/** Zustand session slice + derived stats (APP-001 — extracted from page orchestrator). */
export function useHomeSession() {
  const meshIdentity = useMeshSessionStore(
    useShallow((s) => ({
      mesh: s.session?.mesh ?? null,
      topology: s.session?.topology ?? null,
      fileName: s.session?.fileName ?? null,
      meshLoadVersion: s.meshLoadVersion,
      patternRevision: s.patternRevision,
    })),
  );
  const seams = useMeshSessionStore((s) => s.session?.seams ?? null);
  const cutStrokes = useMeshSessionStore((s) => s.cutStrokes);
  const chrome = useMeshSessionStore(
    useShallow((s) => ({
      isLoading: s.isLoading,
      error: s.error,
      meshEditTool: s.meshEditTool,
      toasts: s.toasts,
    })),
  );
  const actions = useMeshSessionStore(
    useShallow((s) => ({
      loadMeshFile: s.loadMeshFile,
      toggleSeamAt: s.toggleSeamAt,
      clearAllSeams: s.clearAllSeams,
      addCutStroke: s.addCutStroke,
      updateCutStroke: s.updateCutStroke,
      deleteCutStroke: s.deleteCutStroke,
      clearCutStrokes: s.clearCutStrokes,
      setMeshEditTool: s.setMeshEditTool,
      dismissToast: s.dismissToast,
      notifyToast: s.notifyToast,
    })),
  );

  const { mesh, topology, fileName, meshLoadVersion, patternRevision } =
    meshIdentity;
  const { isLoading, error, meshEditTool, toasts } = chrome;

  const session = useMemo((): MeshSession | null => {
    if (!mesh || !topology || !seams || fileName == null) return null;
    return { mesh, topology, seams, fileName };
  }, [mesh, topology, seams, fileName]);

  const seamsKey = seams ? seamsContentKey(seams) : null;
  const stats = useMemo(() => {
    if (!mesh || !topology || !seams || fileName == null) return null;
    return computeSessionStats({ mesh, topology, seams, fileName });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- STATE-003
  }, [mesh, topology, seamsKey, fileName]);

  return {
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
    ...actions,
  };
}
