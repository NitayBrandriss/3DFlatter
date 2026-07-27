"use client";

import { useCallback, useState } from "react";
import { demoLoadFailureMessage } from "@/data/demoLoadMessages";
import { DEMO_MODELS, getDemoModelById } from "@/data/demoModels";

type NotifyToast = (text: string, tone?: "info" | "warning") => void;

/** UI-001 / APP-003: single load paths with shared pre-load reset and demo errors. */
export function useMeshLoadHandlers(
  loadMeshFile: (file: File) => Promise<boolean>,
  notifyToast: NotifyToast,
  onBeforeMeshLoad: () => void,
) {
  const [selectedDemoId, setSelectedDemoId] = useState(DEMO_MODELS[0]?.id ?? "");

  const loadMeshFromFile = useCallback(
    async (file: File | null): Promise<boolean> => {
      if (!file) return false;
      onBeforeMeshLoad();
      return loadMeshFile(file);
    },
    [loadMeshFile, onBeforeMeshLoad],
  );

  const loadSelectedDemo = useCallback(async (): Promise<boolean> => {
    const demo = getDemoModelById(selectedDemoId);
    if (!demo) return false;

    onBeforeMeshLoad();
    const response = await fetch(`/api/demo-models/${demo.id}`);
    if (!response.ok) {
      notifyToast(demoLoadFailureMessage(response.status, demo.label), "warning");
      return false;
    }

    const blob = await response.blob();
    const file = new File([blob], demo.fileName, { type: blob.type });
    return loadMeshFile(file);
  }, [loadMeshFile, notifyToast, onBeforeMeshLoad, selectedDemoId]);

  return {
    selectedDemoId,
    setSelectedDemoId,
    loadMeshFromFile,
    loadSelectedDemo,
  };
}
