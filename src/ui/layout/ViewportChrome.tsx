"use client";

import {
  useCallback,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { SPLIT_2D_MIN } from "./constants";

type MobilePanel = "3d" | "2d";

type ViewportChromeProps = {
  containerRef: RefObject<HTMLElement | null>;
  viewport3dPanelRef: RefObject<HTMLDivElement | null>;
  isDesktop: boolean;
  mobilePanel: MobilePanel;
  onMobilePanelChange: (panel: MobilePanel) => void;
  split2dPx: number;
  isDragging: boolean;
  splitHandleProps: {
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
    tabIndex?: number;
    "aria-valuemin": number;
    "aria-valuemax": number;
    "aria-valuenow": number;
  };
  viewport3d: ReactNode;
  viewport2d: ReactNode;
};

export function ViewportChrome({
  containerRef,
  viewport3dPanelRef,
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

  const onTabListKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }
      event.preventDefault();
      onMobilePanelChange(mobilePanel === "3d" ? "2d" : "3d");
    },
    [mobilePanel, onMobilePanelChange],
  );

  return (
    <main
      ref={containerRef}
      className="viewport viewport-split"
      style={splitStyle}
      data-mobile-panel={isDesktop ? undefined : mobilePanel}
    >
      {!isDesktop ? (
        <div
          className="viewport-tabs"
          role="tablist"
          aria-label="Viewport mode"
          onKeyDown={onTabListKeyDown}
        >
          <button
            type="button"
            role="tab"
            id="viewport-tab-3d"
            className="viewport-tab"
            aria-selected={mobilePanel === "3d"}
            aria-controls="viewport-panel-3d"
            tabIndex={mobilePanel === "3d" ? 0 : -1}
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
            tabIndex={mobilePanel === "2d" ? 0 : -1}
            onClick={() => onMobilePanelChange("2d")}
          >
            2D Pattern
          </button>
        </div>
      ) : null}

      <div
        ref={viewport3dPanelRef}
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

export { SPLIT_2D_MIN };
