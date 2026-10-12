"use client";

import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { CutStroke } from "../logic/cuts/types";
import type { DisplayBounds } from "../logic/isolation/maskGeometry";
import type { FaceMask, FloodCombineMode } from "../logic/isolation/types";
import type { EdgeKey, FaceIndex, MeshModel, SeamRegistry } from "../logic/mesh/types";
import type { MeshEditTool } from "../state/meshEditTool";
import { CutStrokesOverlay } from "./CutStrokesOverlay";
import { CommittedStrokePickables } from "./CommittedStrokePickables";
import {
  CutPolylineSession,
  type CutPolylineActions,
} from "./cutPolyline/CutPolylineSession";
import type {
  CutPolylineDraftApi,
  CutPolylineFinalizeResult,
} from "./cutPolyline/useCutPolylineDraft";
import {
  canPickCommittedStroke,
  excludeCutStrokeById,
} from "./cutPolyline/cutPolylineHelpers";
import {
  applyFitCameraToBounds,
  frameBoundsForIsolation,
  geometryDisplayBounds,
  isolationFrameKey,
} from "./fitCameraToBounds";
import {
  buildDisplayMeshAssets,
  ghostMeshRaycast,
  isolationGeometriesFromDisplay,
} from "./meshModelToGeometry";
import { PickableMesh } from "./PickableMesh";
import { SeamOverlay } from "./SeamOverlay";
import {
  SCENE_AXES_LENGTH,
  SCENE_GRID_DIVISIONS,
  SCENE_GRID_SIZE,
} from "./sceneScale";
import { SyncGlToPanel } from "./syncGlToPanel";

function FitCameraToMesh({
  geometry,
  orbitEnabled,
  frameKey,
  isolateBounds,
}: {
  geometry: THREE.BufferGeometry;
  orbitEnabled: boolean;
  /** `"full"` while isolation is inactive. Changes with masked faces once active. */
  frameKey: string;
  isolateBounds: DisplayBounds | null;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  // Refit on a new file, when isolation becomes active, or when the masked
  // faces change. Seam edits do not change `geometry` or `frameKey`.
  useEffect(() => {
    const controls = controlsRef.current as OrbitControlsImpl | null;
    const full = geometryDisplayBounds(geometry);
    if (!full) return;
    const framed = frameBoundsForIsolation(
      frameKey !== "full",
      full,
      isolateBounds,
    );
    applyFitCameraToBounds(camera, controls, framed);
  }, [camera, geometry, frameKey, isolateBounds]);

  return (
    <OrbitControls
      ref={(r) => {
        controlsRef.current = r as OrbitControlsImpl | null;
      }}
      makeDefault
      enabled={orbitEnabled}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.8}
    />
  );
}

export function MeshViewport({
  mesh,
  seams,
  cutStrokes,
  meshLoadVersion,
  viewportPanelRef,
  wireframe,
  showGrid,
  showAxes,
  modelScale,
  editTool,
  isolationActive,
  isolationMask,
  cutDraftActive,
  editingStrokeId,
  onEdgePick,
  onIsolationFlood,
  onDraftFinalize,
  onCutDraftUiChange,
  cutDraftActionsRef,
  onCutPointCapReached,
  onCutFinalizeTooFewPoints,
}: {
  mesh: MeshModel | null;
  seams: SeamRegistry | null;
  cutStrokes: readonly CutStroke[];
  /** Passed so React re-mounts the canvas scene on a new load if mesh ref is reused. */
  meshLoadVersion: number;
  /** Host `.viewport-3d` element — VIEW-006 resize sync when tab visibility changes. */
  viewportPanelRef: RefObject<HTMLElement | null>;
  wireframe: boolean;
  showGrid: boolean;
  showAxes: boolean;
  modelScale: number;
  editTool: MeshEditTool;
  /** Ghost the remainder only after confirm. Before that the full mesh stays pickable. */
  isolationActive: boolean;
  isolationMask: FaceMask;
  cutDraftActive: boolean;
  editingStrokeId: string | null;
  onEdgePick: (edgeKey: EdgeKey) => void;
  onIsolationFlood: (originalFaceIndex: FaceIndex, mode: FloodCombineMode) => void;
  onDraftFinalize: (result: CutPolylineFinalizeResult) => void;
  onCutDraftUiChange?: (ui: {
    active: boolean;
    canFinalize: boolean;
    editingStrokeId: string | null;
  }) => void;
  cutDraftActionsRef?: RefObject<CutPolylineActions | null>;
  onCutPointCapReached?: () => void;
  onCutFinalizeTooFewPoints?: () => void;
}) {
  // Rebuild display assets only when canonical mesh identity changes (file load).
  const displayAssets = useMemo(() => {
    if (!mesh) return null;
    return buildDisplayMeshAssets(mesh);
  }, [mesh]);

  const frameKey = isolationFrameKey(
    isolationActive,
    isolationActive ? isolationMask : null,
  );

  const isolationView = useMemo(() => {
    if (!displayAssets || !mesh || frameKey === "full") return null;
    return isolationGeometriesFromDisplay(displayAssets, mesh, isolationMask);
  }, [displayAssets, mesh, frameKey, isolationMask]);

  const cutDraftApiRef = useRef<CutPolylineDraftApi | null>(null);
  const pickableMeshRef = useRef<THREE.Mesh | null>(null);
  const [orbitEnabled, setOrbitEnabled] = useState(true);

  const visibleCutStrokes = useMemo(
    () => excludeCutStrokeById(cutStrokes, editingStrokeId),
    [cutStrokes, editingStrokeId],
  );

  const pickCommittedEnabled =
    editTool === "cut" &&
    canPickCommittedStroke(
      cutDraftActive,
      editingStrokeId,
      !orbitEnabled,
    );

  // Release GPU buffers when the mesh is replaced or the viewport unmounts.
  useEffect(() => {
    const geometry = displayAssets?.geometry;
    return () => geometry?.dispose();
  }, [displayAssets?.geometry]);

  useEffect(() => {
    const isolateGeometry = isolationView?.isolateGeometry;
    const ghostGeometry = isolationView?.ghostGeometry;
    return () => {
      isolateGeometry?.dispose();
      ghostGeometry?.dispose();
    };
  }, [isolationView]);

  const sceneKey = mesh ? `mesh-${meshLoadVersion}` : "empty";

  return (
    <Canvas key={sceneKey} camera={{ fov: 50, position: [2, 2, 2] }}>
      <SyncGlToPanel panelRef={viewportPanelRef} />
      <color attach="background" args={["#070912"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 4]} intensity={1.05} />

      {showGrid ? (
        <gridHelper
          args={[
            SCENE_GRID_SIZE,
            SCENE_GRID_DIVISIONS,
            "#2a2f3a",
            "#151925",
          ]}
        />
      ) : null}
      {showAxes ? <axesHelper args={[SCENE_AXES_LENGTH]} /> : null}

      {displayAssets && mesh && seams ? (
        <>
          {isolationView &&
          isolationView.ghostGeometry.getIndex()?.count ? (
            <mesh
              geometry={isolationView.ghostGeometry}
              scale={modelScale}
              raycast={ghostMeshRaycast}
              renderOrder={-1}
            >
              <meshStandardMaterial
                color="#94a3b8"
                transparent
                opacity={0.18}
                depthWrite={false}
                metalness={0.02}
                roughness={1}
                wireframe={wireframe}
              />
            </mesh>
          ) : null}
          <PickableMesh
            geometry={isolationView?.isolateGeometry ?? displayAssets.geometry}
            displayMesh={displayAssets.displayMesh}
            wireframe={wireframe}
            modelScale={modelScale}
            editTool={editTool}
            normalization={displayAssets.normalization}
            onEdgePick={onEdgePick}
            onIsolationFlood={onIsolationFlood}
            isolateFaceIds={isolationView?.isolateFaceIds ?? null}
            cutDraftApiRef={cutDraftApiRef}
            meshRef={pickableMeshRef}
          />
          <SeamOverlay
            displayVertices={displayAssets.displayMesh.vertices}
            seams={seams}
            modelScale={modelScale}
          />
          <CutStrokesOverlay
            mesh={mesh}
            cutStrokes={visibleCutStrokes}
            normalization={displayAssets.normalization}
            modelScale={modelScale}
          />
          <CommittedStrokePickables
            mesh={mesh}
            cutStrokes={visibleCutStrokes}
            normalization={displayAssets.normalization}
            modelScale={modelScale}
            enabled={pickCommittedEnabled}
            onPickStroke={(stroke) => {
              if (cutDraftApiRef.current?.isNodeDragging()) return;
              cutDraftApiRef.current?.enterEditCommitted(
                stroke,
                displayAssets.normalization,
              );
            }}
          />
          <CutPolylineSession
            mesh={mesh}
            editTool={editTool}
            modelScale={modelScale}
            onFinalize={onDraftFinalize}
            onDraftUiChange={onCutDraftUiChange}
            onPointCapReached={onCutPointCapReached}
            onFinalizeTooFewPoints={onCutFinalizeTooFewPoints}
            onOrbitEnabledChange={setOrbitEnabled}
            pickableMeshRef={pickableMeshRef}
            draftApiRef={cutDraftApiRef}
            actionsRef={cutDraftActionsRef}
          />
          <FitCameraToMesh
            geometry={displayAssets.geometry}
            orbitEnabled={orbitEnabled}
            frameKey={frameKey}
            isolateBounds={isolationView?.isolateBounds ?? null}
          />
        </>
      ) : (
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
      )}
    </Canvas>
  );
}
