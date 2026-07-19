import { describe, expect, it } from "vitest";
import { makeEdgeKey, parseEdgeKey } from "./edgeKey";

describe("edgeKey", () => {
  it("makeEdgeKey sorts endpoints", () => {
    expect(makeEdgeKey(3, 1)).toBe("1,3");
    expect(makeEdgeKey(1, 3)).toBe("1,3");
  });

  it("parseEdgeKey rounds trips the stored order", () => {
    const key = makeEdgeKey(12, 5);
    expect(parseEdgeKey(key)).toEqual([5, 12]);
  });

  it("parseEdgeKey uses parseInt (not Number) for endpoints", () => {
    expect(parseEdgeKey("0,8" as `${number},${number}`)).toEqual([0, 8]);
  });
});
