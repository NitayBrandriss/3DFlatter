import { describe, expect, it } from "vitest";
import { demoLoadFailureMessage } from "./demoLoadMessages";

describe("demoLoadFailureMessage", () => {
  it("returns 404-specific copy", () => {
    expect(demoLoadFailureMessage(404, "D20")).toContain("3d_models/");
  });

  it("returns generic copy for other statuses", () => {
    expect(demoLoadFailureMessage(500, "Cube")).toContain("Failed to load");
  });
});
