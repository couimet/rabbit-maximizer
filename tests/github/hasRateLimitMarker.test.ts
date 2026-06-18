import { describe, it, expect } from "@jest/globals";
import { hasRateLimitMarker } from "../../src/github/hasRateLimitMarker.js";

describe("hasRateLimitMarker", () => {
  it("returns true when the body contains the rate-limit marker", () => {
    expect(
      hasRateLimitMarker("some text rate limited by coderabbit.ai more text"),
    ).toBe(true);
  });

  it("returns false when the body does not contain the marker", () => {
    expect(hasRateLimitMarker("some random comment body")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(hasRateLimitMarker("")).toBe(false);
  });
});
