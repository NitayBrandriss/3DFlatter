"use client";

import { useState } from "react";

export function useViewportPreferences() {
  const [wireframe, setWireframe] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(false);
  const [modelScale, setModelScale] = useState(1);

  const resetModelScale = () => setModelScale(1);

  return {
    wireframe,
    setWireframe,
    showGrid,
    setShowGrid,
    showAxes,
    setShowAxes,
    modelScale,
    setModelScale,
    resetModelScale,
  };
}
