import { jest, describe, it, expect } from "@jest/globals";
import { getUniqueString } from "@couimet/dynamic-testing";
import pkg from "../../package.json" with { type: "json" };

const randomUUID = jest.fn();
jest.unstable_mockModule("node:crypto", () => ({ randomUUID }));

const { UuidObservationContextProvider } =
  await import("../../src/observability/observationContext.js");

describe("UuidObservationContextProvider", () => {
  it("returns uuid correlation and request ids plus the package version", () => {
    const correlationId = getUniqueString({ prefix: "corr-" });
    const requestId = getUniqueString({ prefix: "req-" });
    randomUUID
      .mockReturnValueOnce(correlationId)
      .mockReturnValueOnce(requestId);

    const sut = new UuidObservationContextProvider();
    const result = sut.current();

    expect(result).toStrictEqual({
      correlationId,
      requestId,
      version: pkg.version,
    });
    expect(randomUUID).toHaveBeenCalledTimes(2);
  });
});
