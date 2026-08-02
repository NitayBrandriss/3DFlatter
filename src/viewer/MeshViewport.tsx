"use client";

import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { CutStroke, Vec3 } from "../logic/cuts/types";
import type { EdgeKey, MeshModel, SeamRegistry } from "../logic/mesh/types";
import type { MeshEditTool } from "../state/meshEditTool";
import { CutStrokesOverlay } from "./CutStrokesOverlay";
import {
  CutPolylineSession,
  type CutPolylineActions,
} from "./cutPolyline/CutPolylineSession";
import type { CutPolylineDraftApi } from "./cutPolyline/useCutPolylineDraft";
import { buildDisplayMeshAssets } from "./meshModelToGeometry";
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
}: {
  geometry: THREE.BufferGeometry;
  orbitEnabled: boolean;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  // Refit only when geometry identity changes (new file load), not on seam edits.
  // Three.js PerspectiveCamera is a mutable scene object; R3F's camera is updated in place.
  /* eslint-disable react-hooks/immutability -- intentional Three.js camera mutation */
  useEffect(() => {
    geometry.computeBoundingSphere();
    const sphere = geometry.boundingSphere;
    if (!sphere) return;

    const radius = sphere.radius || 1;
    const center = sphere.center.clone();

    const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 50;
    const fovRad = (fov * Math.PI) / 180;
    const distance = radius / Math.sin(fovRad / 2);

    const dir = new THREE.Vector3(1, 0.7, 1).normalize();
    camera.position.copy(center.clone().add(dir.multiplyScalar(distance * 1.15)));
    camera.near = Math.max(0.01, distance / 100);
    camera.far = distance * 100;
    camera.updateProjectionMatrix();

    const controls = controlsRef.current as OrbitControlsImpl | null;
    if (controls) {
      controls.target.copy(center);
      controls.update();
    }
  }, [camera, geometry]);
  /* eslint-enable react-hooks/immutability */

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
  onEdgePick,
  onCutStrokeCommit,
  onCutDraftActiveChange,
  cutDraftActionsRef,
  onCutPointCapReached,
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
  onEdgePick: (edgeKey: EdgeKey) => void;
  onCutStrokeCommit: (points: Vec3[]) => void;
  onCutDraftActiveChange?: (active: boolean) => void;
  cutDraftActionsRef?: RefObject<CutPolylineActions | null>;
  onCutPointCapReached?: () => void;
}) {
  // Rebuild display assets only when canonical mesh identity changes (file load).
  const displayAssets = useMemo(() => {
    if (!mesh) return null;
    return buildDisplayMeshAssets(mesh);
  }, [mesh]);

  const cutDraftApiRef = useRef<CutPolylineDraftApi | null>(null);
  // Orbit stays enabled while drafting; Slice C disables only during node grab.
  const orbitEnabled = true;

  // Release GPU buffers when the mesh is replaced or the viewport unmounts.
  useEffect(() => {
    const geometry = displayAssets?.geometry;
    return () => geometry?.dispose();
  }, [displayAssets?.geometry]);

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
          <PickableMesh
            geometry={displayAssets.geometry}
            displayMesh={displayAssets.displayMesh}
            wireframe={wireframe}
            modelScale={modelScale}
            editTool={editTool}
            normalization={displayAssets.normalization}
            onEdgePick={onEdgePick}
            cutDraftApiRef={cutDraftApiRef}
          />
          <SeamOverlay
            displayVertices={displayAssets.displayMesh.vertices}
            seams={seams}
            modelScale={modelScale}
          />
          <CutStrokesOverlay
            cutStrokes={cutStrokes}
            normalization={displayAssets.normalization}
            modelScale={modelScale}
          />
          <CutPolylineSession
            editTool={editTool}
            modelScale={modelScale}
            onCommit={onCutStrokeCommit}
            onDraftActiveChange={onCutDraftActiveChange}
            onPointCapReached={onCutPointCapReached}
            draftApiRef={cutDraftApiRef}
            actionsRef={cutDraftActionsRef}
          />
          <FitCameraToMesh
            geometry={displayAssets.geometry}
            orbitEnabled={orbitEnabled}
          />
        </>
      ) : (
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
      )}
    </Canvas>
  );
}
