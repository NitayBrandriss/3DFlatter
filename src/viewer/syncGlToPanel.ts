"use client";

import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect, type RefObject } from "react";

/** VIEW-006: keep R3F renderer sized when the host panel is hidden then shown (mobile tabs). */
export function SyncGlToPanel({
  panelRef,
}: {
  panelRef: RefObject<HTMLElement | null>;
}) {
  const { gl, camera, invalidate } = useThree();

  /* eslint-disable react-hooks/immutability -- R3F PerspectiveCamera is mutated in place (VIEW-006) */
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const sync = () => {
      const w = panel.clientWidth;
      const h = panel.clientHeight;
      if (w <= 0 || h <= 0) return;

      gl.setSize(w, h, false);
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      invalidate();
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(panel);
    return () => ro.disconnect();
  }, [panelRef, gl, camera, invalidate]);
  /* eslint-enable react-hooks/immutability */

  return null;
}
