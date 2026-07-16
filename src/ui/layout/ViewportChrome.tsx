"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";
import { SPLIT_2D_MIN } from "./constants";

type MobilePanel = "3d" | "2d";

type ViewportChromeProps = {
  containerRef: RefObject<HTMLElement | null>;
  isDesktop: boolean;
  mobilePanel: MobilePanel;
  onMobilePanelChange: (panel: MobilePanel) => void;
  split2dPx: number;
  isDragging: boolean;
  splitHandleProps: {
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
    "aria-valuemin": number;
    "aria-valuemax": number;
    "aria-valuenow": number;
  };
  viewport3d: ReactNode;
  viewport2d: ReactNode;
};

export function ViewportChrome({
  containerRef,
  isDesktop,
  mobilePanel,
  onMobilePanelChange,
  split2dPx,
  isDragging,
  splitHandleProps,
  viewport3d,
  viewport2d,
}: ViewportChromeProps) {
  const splitStyle = {
    "--split-2d-height": `${split2dPx}px`,
  } as CSSProperties;

  return (
    <main
      ref={containerRef}
      className="viewport viewport-split"
      style={splitStyle}
      data-mobile-panel={isDesktop ? undefined : mobilePanel}
    >
      {!isDesktop ? (
        <div className="viewport-tabs" role="tablist" aria-label="Viewport mode">
          <button
            type="button"
            role="tab"
            id="viewport-tab-3d"
            className="viewport-tab"
            aria-selected={mobilePanel === "3d"}
            aria-controls="viewport-panel-3d"
            onClick={() => onMobilePanelChange("3d")}
          >
            3D
          </button>
          <button
            type="button"
            role="tab"
            id="viewport-tab-2d"
            className="viewport-tab"
            aria-selected={mobilePanel === "2d"}
            aria-controls="viewport-panel-2d"
            onClick={() => onMobilePanelChange("2d")}
          >
            2D Pattern
          </button>
        </div>
      ) : null}

      <div
        id="viewport-panel-3d"
        className="viewport-3d"
        role={isDesktop ? undefined : "tabpanel"}
        aria-labelledby={isDesktop ? undefined : "viewport-tab-3d"}
        hidden={!isDesktop && mobilePanel !== "3d"}
      >
        {viewport3d}
      </div>

      {isDesktop ? (
        <div
          className={`viewport-split-handle${isDragging ? " is-dragging" : ""}`}
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize 2D panel"
          {...splitHandleProps}
        />
      ) : null}

      <div
        id="viewport-panel-2d"
        className="flatten-panel-host"
        role={isDesktop ? undefined : "tabpanel"}
        aria-labelledby={isDesktop ? undefined : "viewport-tab-2d"}
        hidden={!isDesktop && mobilePanel !== "2d"}
      >
        {viewport2d}
      </div>
    </main>
  );
}

export type { MobilePanel };

// Re-export min for aria in parent if needed
export { SPLIT_2D_MIN };
