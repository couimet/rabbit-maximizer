import { describe, it, expect } from "@jest/globals";
import {
  QueueStatus,
  EventType,
  CODERABBIT_SELF_MARKER_PREFIX,
  CODERABBIT_RATE_LIMIT_MARKER,
  CODERABBIT_RETRIGGER_COMMAND,
} from "../src/types/index.js";

describe("QueueStatus", () => {
  it("has the correct values", () => {
    expect(QueueStatus).toStrictEqual({
      pending: "pending",
      completed: "completed",
      failed: "failed",
    });
  });
});

describe("EventType", () => {
  it("has the correct values", () => {
    expect(EventType).toStrictEqual({
      detected: "detected",
      enqueued: "enqueued",
      posted: "posted",
      rejected: "rejected",
      completed: "completed",
      failed: "failed",
    });
  });
});

describe("coderabbit constants", () => {
  it("CODERABBIT_SELF_MARKER_PREFIX matches our tool marker", () => {
    expect(CODERABBIT_SELF_MARKER_PREFIX).toBe("<!-- rabbit-optimizer");
  });

  it("CODERABBIT_RATE_LIMIT_MARKER is the known CodeRabbit hidden marker", () => {
    expect(CODERABBIT_RATE_LIMIT_MARKER).toBe("rate limited by coderabbit.ai");
  });

  it("CODERABBIT_RETRIGGER_COMMAND is the full review command", () => {
    expect(CODERABBIT_RETRIGGER_COMMAND).toBe("@coderabbitai full review");
  });
});
