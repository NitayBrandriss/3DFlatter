import { describe, expect, it } from "vitest";
import { meshPointerAction } from "./meshEditTool";

describe("meshPointerAction", () => {
  it("isolate with no modifiers floods replace", () => {
    expect(meshPointerAction("isolate", false, false)).toEqual({
      type: "flood",
      mode: "replace",
    });
  });

  it("isolate with Shift only floods add", () => {
    expect(meshPointerAction("isolate", true, false)).toEqual({
      type: "flood",
      mode: "add",
    });
  });

  it("isolate with Alt only floods subtract and the pick path does not pivot", () => {
    expect(meshPointerAction("isolate", false, true)).toEqual({
      type: "flood",
      mode: "subtract",
    });
  });

  it("isolate with Shift and Alt does nothing (no flood, no pivot)", () => {
    expect(meshPointerAction("isolate", true, true)).toEqual({ type: "none" });
  });

  it("Alt on seam, cut, or orbit still pivots", () => {
    expect(meshPointerAction("seam", false, true)).toEqual({ type: "pivot" });
    expect(meshPointerAction("cut", false, true)).toEqual({ type: "pivot" });
    expect(meshPointerAction("none", false, true)).toEqual({ type: "pivot" });
    expect(meshPointerAction("seam", true, true)).toEqual({ type: "pivot" });
    expect(meshPointerAction("cut", true, true)).toEqual({ type: "pivot" });
    expect(meshPointerAction("none", true, true)).toEqual({ type: "pivot" });
  });
});
