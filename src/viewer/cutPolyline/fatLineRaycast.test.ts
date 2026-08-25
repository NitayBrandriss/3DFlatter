import { describe, expect, it } from "vitest";
import {
  COMMITTED_LINE_PICK_TARGET_PX,
  LINE_PICK_THRESHOLD,
  LINE_PICK_THRESHOLD_MAX,
  LINE_PICK_TARGET_PX,
  linePickThresholdForDistance,
} from "./fatLineRaycast";

describe("linePickThresholdForDistance", () => {
  it("shrinks when the camera is closer (zoomed in)", () => {
    const far = linePickThresholdForDistance({
      distance: 4,
      fovDeg: 50,
      viewportHeightPx: 800,
      targetPx: COMMITTED_LINE_PICK_TARGET_PX,
    });
    const near = linePickThresholdForDistance({
      distance: 0.4,
      fovDeg: 50,
      viewportHeightPx: 800,
      targetPx: COMMITTED_LINE_PICK_TARGET_PX,
    });
    expect(near).toBeLessThan(far);
    expect(near).toBeLessThan(LINE_PICK_THRESHOLD);
  });

  it("committed target stays larger than draft at the same framing", () => {
    const draft = linePickThresholdForDistance({
      distance: 3,
      fovDeg: 50,
      viewportHeightPx: 800,
      targetPx: LINE_PICK_TARGET_PX,
    });
    const committed = linePickThresholdForDistance({
      distance: 3,
      fovDeg: 50,
      viewportHeightPx: 800,
      targetPx: COMMITTED_LINE_PICK_TARGET_PX,
    });
    expect(committed).toBeGreaterThan(draft);
  });

  it("clamps to LINE_PICK_THRESHOLD_MAX at long distance", () => {
    const t = linePickThresholdForDistance({
      distance: 100,
      fovDeg: 50,
      viewportHeightPx: 800,
      targetPx: COMMITTED_LINE_PICK_TARGET_PX,
    });
    expect(t).toBe(LINE_PICK_THRESHOLD_MAX);
  });

  it("returns fallback for invalid inputs", () => {
    expect(
      linePickThresholdForDistance({
        distance: 0,
        fovDeg: 50,
        viewportHeightPx: 800,
      }),
    ).toBe(LINE_PICK_THRESHOLD);
  });
});
