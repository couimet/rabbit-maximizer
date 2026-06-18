import { jest, describe, it, expect } from "@jest/globals";
import { initLogger } from "../src/logger.js";
import { getLogger } from "@couimet/logger-contract";

describe("initLogger", () => {
  it("registers a ConsoleLogger that logs to console at all four levels", () => {
    const mockDebug = jest.spyOn(console, "debug").mockImplementation(() => {});
    const mockInfo = jest.spyOn(console, "info").mockImplementation(() => {});
    const mockWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const mockError = jest.spyOn(console, "error").mockImplementation(() => {});

    initLogger();

    const logger = getLogger();
    logger.debug({ fn: "testFn" }, "debug msg");
    logger.info({ fn: "testFn" }, "info msg");
    logger.warn({ fn: "testFn" }, "warn msg");
    logger.error({ fn: "testFn" }, "error msg");

    expect(mockDebug).toHaveBeenCalledWith('[DEBUG] {"fn":"testFn"} debug msg');
    expect(mockInfo).toHaveBeenCalledWith('[INFO] {"fn":"testFn"} info msg');
    expect(mockWarn).toHaveBeenCalledWith('[WARN] {"fn":"testFn"} warn msg');
    expect(mockError).toHaveBeenCalledWith('[ERROR] {"fn":"testFn"} error msg');
  });

  it("includes extra context keys in the log output", () => {
    const mockDebug = jest.spyOn(console, "debug").mockImplementation(() => {});
    const mockInfo = jest.spyOn(console, "info").mockImplementation(() => {});
    const mockWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const mockError = jest.spyOn(console, "error").mockImplementation(() => {});

    initLogger();
    const logger = getLogger();
    const ctx = { fn: "testFn", pr: 42, repo: "couimet/rabbit-optimizer" };

    logger.debug(ctx, "debug msg");
    logger.info(ctx, "info msg");
    logger.warn(ctx, "warn msg");
    logger.error(ctx, "error msg");

    expect(mockDebug).toHaveBeenCalledWith(
      '[DEBUG] {"fn":"testFn","pr":42,"repo":"couimet/rabbit-optimizer"} debug msg',
    );
    expect(mockInfo).toHaveBeenCalledWith(
      '[INFO] {"fn":"testFn","pr":42,"repo":"couimet/rabbit-optimizer"} info msg',
    );
    expect(mockWarn).toHaveBeenCalledWith(
      '[WARN] {"fn":"testFn","pr":42,"repo":"couimet/rabbit-optimizer"} warn msg',
    );
    expect(mockError).toHaveBeenCalledWith(
      '[ERROR] {"fn":"testFn","pr":42,"repo":"couimet/rabbit-optimizer"} error msg',
    );
  });
});
