import { describe, it, expect } from "@jest/globals";
import { hasOwnRetriggerMarker } from "../../src/github/hasOwnRetriggerMarker.js";

describe("hasOwnRetriggerMarker", () => {
  it("returns true when the body contains the own marker prefix", () => {
    expect(
      hasOwnRetriggerMarker("<!-- rabbit-optimizer v0.1.0 run=abc123"),
    ).toBe(true);
  });

  it("returns false when the body contains only the rate-limit marker", () => {
    expect(hasOwnRetriggerMarker("rate limited by coderabbit.ai")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(hasOwnRetriggerMarker("")).toBe(false);
  });
});
