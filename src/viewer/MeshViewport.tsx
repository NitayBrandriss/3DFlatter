"use client";

import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { MeshModel } from "../logic/mesh/types";
import { meshModelToGeometry } from "./meshModelToGeometry";

function FitCameraToMesh({
  geometry,
  version,
}: {
  geometry: THREE.BufferGeometry;
  version: number;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

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

    const controls = controlsRef.current as any;
    if (controls) {
      controls.target.copy(center);
      controls.update();
    }
  }, [camera, geometry, version]);

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
  meshRef,
  meshVersion,
  wireframe,
  showGrid,
  showAxes,
}: {
  meshRef: React.RefObject<MeshModel | null>;
  meshVersion: number;
  wireframe: boolean;
  showGrid: boolean;
  showAxes: boolean;
}) {
  const geometry = useMemo(() => {
    const mesh = meshRef.current;
    if (!mesh) return null;
    const g = meshModelToGeometry(mesh);

    // Center the geometry at origin for stable orbiting.
    const box = g.boundingBox;
    if (box) {
      const center = box.getCenter(new THREE.Vector3());
      g.translate(-center.x, -center.y, -center.z);
    }

    g.computeBoundingSphere();
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meshVersion]);

  return (
    <Canvas camera={{ fov: 50, position: [2, 2, 2] }}>
      <color attach="background" args={["#070912"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 4]} intensity={1.05} />

      {showGrid ? <gridHelper args={[10, 20, "#2a2f3a", "#151925"]} /> : null}
      {showAxes ? <axesHelper args={[2]} /> : null}

      {geometry ? (
        <>
          <mesh geometry={geometry}>
            <meshStandardMaterial
              color="#cbd5e1"
              metalness={0.05}
              roughness={0.9}
              wireframe={wireframe}
            />
          </mesh>
          <FitCameraToMesh geometry={geometry} version={meshVersion} />
        </>
      ) : (
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
      )}
    </Canvas>
  );
}

