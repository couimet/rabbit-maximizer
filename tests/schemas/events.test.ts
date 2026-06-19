import { describe, it, expect } from "@jest/globals";
import type { Event as PrismaEvent } from "@prisma/client";
import { parseEventRow } from "../../src/schemas/events.js";
import {
  COMMENT_URL_MAX_LENGTH,
  NEW_WAIT_MAX_LENGTH,
  REASON_MAX_LENGTH,
} from "../../src/schemas/lengths.js";
import { EventType } from "../../src/types/index.js";
import {
  getUniqueInt,
  getUniqueString,
  getUniqueDate,
} from "@couimet/dynamic-testing";

const baseRow = (over: Partial<PrismaEvent>): PrismaEvent =>
  ({
    id: getUniqueInt(),
    uuid: getUniqueString(),
    ts: getUniqueDate(),
    type: "detected",
    repo_full_name: getUniqueString(),
    pr_number: getUniqueInt(),
    correlation_id: getUniqueString(),
    request_id: null,
    version: getUniqueString(),
    payload: "{}",
    metadata: null,
    ...over,
  }) as PrismaEvent;

describe("parseEventRow", () => {
  it("parses a detected event with metadata and request id", () => {
    const sourceTs = getUniqueDate();
    const sourceCommentUrl = getUniqueString();
    const metadata = {
      git_sha: getUniqueString(),
      node_version: getUniqueString(),
    };
    const requestId = getUniqueString();
    const row = baseRow({
      type: "detected",
      request_id: requestId,
      metadata: JSON.stringify(metadata),
      payload: JSON.stringify({
        source_ts: sourceTs.toISOString(),
        source_comment_url: sourceCommentUrl,
      }),
    });

    const result = parseEventRow(row);

    expect(result).toStrictEqual({
      id: row.id,
      uuid: row.uuid,
      ts: row.ts,
      repo_full_name: row.repo_full_name,
      pr_number: row.pr_number,
      correlation_id: row.correlation_id,
      request_id: requestId,
      version: row.version,
      metadata,
      type: "detected",
      payload: { source_ts: sourceTs, source_comment_url: sourceCommentUrl },
    });
  });

  it("parses an enqueued event coercing dates and omitting absent optionals", () => {
    const scheduledFor = getUniqueDate();
    const row = baseRow({
      type: "enqueued",
      payload: JSON.stringify({
        scheduled_for: scheduledFor.toISOString(),
        attempt_no: 2,
        new_wait: "60",
      }),
    });

    const result = parseEventRow(row);

    expect(result.type).toBe("enqueued");
    expect(result.payload).toStrictEqual({
      scheduled_for: scheduledFor,
      attempt_no: 2,
      new_wait: "60",
    });
    expect(result.request_id).toBeUndefined();
    expect(result.metadata).toBeUndefined();
  });

  it("parses a posted event", () => {
    const sourceCommentUrl = getUniqueString();
    const postedCommentUrl = getUniqueString();
    const row = baseRow({
      type: "posted",
      payload: JSON.stringify({
        source_comment_url: sourceCommentUrl,
        posted_comment_url: postedCommentUrl,
      }),
    });

    const result = parseEventRow(row);

    expect(result.type).toBe("posted");
    expect(result.payload).toStrictEqual({
      source_comment_url: sourceCommentUrl,
      posted_comment_url: postedCommentUrl,
    });
  });

  it("parses a rejected event", () => {
    const reason = getUniqueString();
    const row = baseRow({
      type: "rejected",
      payload: JSON.stringify({ reason }),
    });

    const result = parseEventRow(row);

    expect(result.type).toBe("rejected");
    expect(result.payload).toStrictEqual({ reason });
  });

  it("parses a completed event", () => {
    const postedCommentUrl = getUniqueString();
    const row = baseRow({
      type: "completed",
      payload: JSON.stringify({ posted_comment_url: postedCommentUrl }),
    });

    const result = parseEventRow(row);

    expect(result.type).toBe("completed");
    expect(result.payload).toStrictEqual({
      posted_comment_url: postedCommentUrl,
    });
  });

  it("parses a failed event", () => {
    const reason = getUniqueString();
    const row = baseRow({
      type: "failed",
      payload: JSON.stringify({ reason }),
    });

    const result = parseEventRow(row);

    expect(result.type).toBe("failed");
    expect(result.payload).toStrictEqual({ reason });
  });

  it("throws on an unknown event type", () => {
    const row = baseRow({ type: "bogus", payload: "{}" });
    expect(() => parseEventRow(row)).toThrow("Unknown event type: bogus");
  });

  it("rejects an enqueued payload missing attempt_no", () => {
    const row = baseRow({
      type: "enqueued",
      payload: JSON.stringify({ scheduled_for: getUniqueDate().toISOString() }),
    });
    expect(() => parseEventRow(row)).toThrow();
  });
});

describe("payload length limits", () => {
  it("rejects a posted event whose comment URL exceeds the max", () => {
    const row = baseRow({
      type: "posted",
      payload: JSON.stringify({
        source_comment_url: "a".repeat(COMMENT_URL_MAX_LENGTH + 1),
        posted_comment_url: getUniqueString(),
      }),
    });
    expect(() => parseEventRow(row)).toThrow();
  });

  it("rejects a failed event whose reason exceeds the max", () => {
    const row = baseRow({
      type: "failed",
      payload: JSON.stringify({ reason: "a".repeat(REASON_MAX_LENGTH + 1) }),
    });
    expect(() => parseEventRow(row)).toThrow();
  });

  it("rejects an enqueued event whose new_wait exceeds the max", () => {
    const row = baseRow({
      type: "enqueued",
      payload: JSON.stringify({
        scheduled_for: getUniqueDate().toISOString(),
        attempt_no: 1,
        new_wait: "a".repeat(NEW_WAIT_MAX_LENGTH + 1),
      }),
    });
    expect(() => parseEventRow(row)).toThrow();
  });
});

describe("EventType discriminator", () => {
  it("uses the literal type strings as payload keys", () => {
    expect(EventType.detected).toBe("detected");
  });
});
