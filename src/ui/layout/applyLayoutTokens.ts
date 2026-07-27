import {
  LAYOUT_BREAKPOINT_PX,
  SIDEBAR_OPEN_WIDTH,
  SIDEBAR_RAIL_WIDTH,
  SPLIT_2D_DEFAULT,
  SPLIT_2D_MIN,
  SPLIT_2D_MAX_RATIO,
} from "./constants";

/** LAYOUT-001: push TS layout numbers to CSS custom properties (client only). */
export function applyLayoutTokensToDocument(): void {
  const root = document.documentElement;
  root.style.setProperty("--layout-breakpoint", `${LAYOUT_BREAKPOINT_PX}px`);
  root.style.setProperty("--sidebar-open-width", `${SIDEBAR_OPEN_WIDTH}px`);
  root.style.setProperty("--sidebar-rail-width", `${SIDEBAR_RAIL_WIDTH}px`);
  root.style.setProperty("--split-2d-default", `${SPLIT_2D_DEFAULT}px`);
  root.style.setProperty("--split-2d-min", `${SPLIT_2D_MIN}px`);
  root.style.setProperty("--split-2d-max-ratio", String(SPLIT_2D_MAX_RATIO));
}
