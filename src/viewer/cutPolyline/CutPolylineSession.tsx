"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { Vec3 } from "../../logic/cuts/types";
import type { MeshEditTool } from "../../state/meshEditTool";
import {
  DraftVertexMarkers,
  type DraftVertexMarkersHandle,
} from "./DraftVertexMarkers";
import {
  InProgressPolylineLine,
  type InProgressPolylineHandle,
} from "./InProgressPolylineLine";
import {
  useCutPolylineDraft,
  type CutPolylineDraftApi,
  type CutPolylineDraftUi,
} from "./useCutPolylineDraft";

export type CutPolylineActions = Pick<
  CutPolylineDraftApi,
  "finalize" | "cancel"
>;

export function CutPolylineSession({
  editTool,
  modelScale,
  onCommit,
  onDraftUiChange,
  onPointCapReached,
  onFinalizeTooFewPoints,
  draftApiRef,
  actionsRef,
}: {
  editTool: MeshEditTool;
  modelScale: number;
  onCommit: (points: Vec3[]) => void;
  onDraftUiChange?: (ui: CutPolylineDraftUi) => void;
  onPointCapReached?: () => void;
  onFinalizeTooFewPoints?: () => void;
  draftApiRef: RefObject<CutPolylineDraftApi | null>;
  actionsRef?: RefObject<CutPolylineActions | null>;
}) {
  const lineRef = useRef<InProgressPolylineHandle | null>(null);
  const markersRef = useRef<DraftVertexMarkersHandle | null>(null);
  const { api } = useCutPolylineDraft({
    lineRef,
    markersRef,
    editTool,
    onCommit,
    onDraftUiChange,
    onPointCapReached,
    onFinalizeTooFewPoints,
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

  const onFirstMarkerClick = useCallback(() => {
    api.closeOnFirstMarkerClick();
  }, [api]);

  return (
    <>
      <InProgressPolylineLine ref={lineRef} modelScale={modelScale} />
      <DraftVertexMarkers
        ref={markersRef}
        modelScale={modelScale}
        onFirstMarkerClick={onFirstMarkerClick}
      />
    </>
  );
}
