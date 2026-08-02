"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { Vec3 } from "../../logic/cuts/types";
import type { MeshEditTool } from "../../state/meshEditTool";
import {
  InProgressPolylineLine,
  type InProgressPolylineHandle,
} from "./InProgressPolylineLine";
import {
  useCutPolylineDraft,
  type CutPolylineDraftApi,
} from "./useCutPolylineDraft";

export type CutPolylineActions = Pick<
  CutPolylineDraftApi,
  "finalize" | "cancel"
>;

export function CutPolylineSession({
  editTool,
  modelScale,
  onCommit,
  onDraftActiveChange,
  onPointCapReached,
  draftApiRef,
  actionsRef,
}: {
  editTool: MeshEditTool;
  modelScale: number;
  onCommit: (points: Vec3[]) => void;
  onDraftActiveChange?: (active: boolean) => void;
  onPointCapReached?: () => void;
  draftApiRef: RefObject<CutPolylineDraftApi | null>;
  actionsRef?: RefObject<CutPolylineActions | null>;
}) {
  const lineRef = useRef<InProgressPolylineHandle | null>(null);
  const { api } = useCutPolylineDraft({
    lineRef,
    editTool,
    onCommit,
    onDraftActiveChange,
    onPointCapReached,
  });

  useEffect(() => {
    draftApiRef.current = api;
    return () => {
      draftApiRef.current = null;
    };
  }, [api, draftApiRef]);

  useEffect(() => {
    if (!actionsRef) return;
    actionsRef.current = {
      finalize: () => {
        api.finalize();
      },
      cancel: () => {
        api.cancel();
      },
    };
    return () => {
      actionsRef.current = null;
    };
  }, [actionsRef, api]);

  return <InProgressPolylineLine ref={lineRef} modelScale={modelScale} />;
}
