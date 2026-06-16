"use client";

import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { EdgeKey, MeshModel, SeamRegistry } from "../logic/mesh/types";
import { buildDisplayMeshAssets } from "./meshModelToGeometry";
import { PickableMesh } from "./PickableMesh";
import { SeamOverlay } from "./SeamOverlay";
import {
  SCENE_AXES_LENGTH,
  SCENE_GRID_DIVISIONS,
  SCENE_GRID_SIZE,
} from "./sceneScale";

function FitCameraToMesh({ geometry }: { geometry: THREE.BufferGeometry }) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  // Refit only when geometry identity changes (new file load), not on seam edits.
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

  return (
    <OrbitControls
      ref={(r) => {
        controlsRef.current = r as OrbitControlsImpl | null;
      }}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.8}
    />
  );
}

export function MeshViewport({
  mesh,
  seams,
  meshLoadVersion,
  wireframe,
  showGrid,
  showAxes,
  modelScale,
  seamMode,
  onEdgePick,
}: {
  mesh: MeshModel | null;
  seams: SeamRegistry | null;
  /** Passed so React re-mounts the canvas scene on a new load if mesh ref is reused. */
  meshLoadVersion: number;
  wireframe: boolean;
  showGrid: boolean;
  showAxes: boolean;
  modelScale: number;
  seamMode: boolean;
  onEdgePick: (edgeKey: EdgeKey) => void;
}) {
  // Rebuild display assets only when canonical mesh identity changes (file load).
  const displayAssets = useMemo(() => {
    if (!mesh) return null;
    return buildDisplayMeshAssets(mesh);
  }, [mesh]);

  // Release GPU buffers when the mesh is replaced or the viewport unmounts.
  useEffect(() => {
    const geometry = displayAssets?.geometry;
    return () => geometry?.dispose();
  }, [displayAssets?.geometry]);

  const sceneKey = mesh ? `mesh-${meshLoadVersion}` : "empty";

  return (
    <Canvas key={sceneKey} camera={{ fov: 50, position: [2, 2, 2] }}>
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
            seamMode={seamMode}
            onEdgePick={onEdgePick}
          />
          <SeamOverlay
            displayVertices={displayAssets.displayMesh.vertices}
            seams={seams}
            modelScale={modelScale}
          />
          <FitCameraToMesh geometry={displayAssets.geometry} />
        </>
      ) : (
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
      )}
    </Canvas>
  );
}
