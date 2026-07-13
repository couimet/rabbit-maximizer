import { parseEventRow } from '../../src/schemas/events.js';
import { COMMENT_URL_MAX_LENGTH, REASON_MAX_LENGTH } from '../../src/schemas/lengths.js';
import { EventType } from '../../src/types/index.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';
import type { Event as PrismaEvent } from '@prisma/client';

const EXCEEDS_MAX_BY = 1;
const DEFAULT_NEW_WAIT = 60;

const baseRow = (over: Partial<PrismaEvent>): PrismaEvent =>
  ({
    id: getUniqueInt(),
    uuid: getUuid(),
    ts: getUniqueDate(),
    type: 'detected',
    repo_full_name: getUniqueGitHubRepoRef().fullName,
    pr_number: getUniqueInt(),
    correlation_id: getUuid(),
    request_id: null,
    version: getUniqueString(),
    payload: '{}',
    metadata: null,
    ...over,
  }) as PrismaEvent;

describe('parseEventRow', () => {
  it('parses a detected event with metadata and request id', () => {
    const sourceTs = getUniqueDate();
    const sourceCommentUrl = getUniqueString();
    const metadata = {
      git_sha: getUniqueString(),
      node_version: getUniqueString(),
    };
    const requestId = getUuid();
    const row = baseRow({
      type: 'detected',
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
      type: 'detected',
      payload: { source_ts: sourceTs, source_comment_url: sourceCommentUrl },
    });
  });

  it('parses an enqueued event coercing dates', () => {
    const notBefore = getUniqueDate();
    const row = baseRow({
      type: 'enqueued',
      payload: JSON.stringify({
        not_before: notBefore.toISOString(),
        new_wait: DEFAULT_NEW_WAIT,
      }),
    });

    const result = parseEventRow(row);

    expect(result.type).toBe('enqueued');
    expect(result.payload).toStrictEqual({
      not_before: notBefore,
      new_wait: 60,
    });
    expect(result.request_id).toBeUndefined();
    expect(result.metadata).toBeUndefined();
  });

  it('parses a retriggered event', () => {
    const sourceCommentUrl = getUniqueString();
    const retriggeredCommentUrl = getUniqueString();
    const row = baseRow({
      type: 'retriggered',
      payload: JSON.stringify({
        source_comment_url: sourceCommentUrl,
        retriggered_comment_url: retriggeredCommentUrl,
      }),
    });

    const result = parseEventRow(row);

    expect(result.type).toBe('retriggered');
    expect(result.payload).toStrictEqual({
      source_comment_url: sourceCommentUrl,
      retriggered_comment_url: retriggeredCommentUrl,
    });
  });

  it('parses a bypassed event', () => {
    const reason = 'prMerged';
    const detail = getUniqueString();
    const row = baseRow({
      type: 'bypassed',
      payload: JSON.stringify({ reason, detail }),
    });

    const result = parseEventRow(row);

    expect(result.type).toBe('bypassed');
    expect(result.payload).toStrictEqual({ reason: 'prMerged', detail });
  });

  it('parses a coderabbit_review_approved event', () => {
    const coderabbitCommentUrl = getUniqueString();
    const row = baseRow({
      type: 'coderabbit_review_approved',
      payload: JSON.stringify({ coderabbit_comment_url: coderabbitCommentUrl }),
    });

    const result = parseEventRow(row);

    expect(result.type).toBe('coderabbit_review_approved');
    expect(result.payload).toStrictEqual({
      coderabbit_comment_url: coderabbitCommentUrl,
    });
  });

  it('parses a coderabbit_review_changes_requested event', () => {
    const coderabbitCommentUrl = getUniqueString();
    const row = baseRow({
      type: 'coderabbit_review_changes_requested',
      payload: JSON.stringify({ coderabbit_comment_url: coderabbitCommentUrl }),
    });

    const result = parseEventRow(row);

    expect(result.type).toBe('coderabbit_review_changes_requested');
    expect(result.payload).toStrictEqual({
      coderabbit_comment_url: coderabbitCommentUrl,
    });
  });

  it('parses a failed event', () => {
    const reason = getUniqueString();
    const row = baseRow({
      type: 'failed',
      payload: JSON.stringify({ reason }),
    });

    const result = parseEventRow(row);

    expect(result.type).toBe('failed');
    expect(result.payload).toStrictEqual({ reason });
  });

  it('throws on an unexpected event type', () => {
    const row = baseRow({ type: 'bogus', payload: '{}' });
    expect(() => parseEventRow(row)).toThrowDetailedError('UNEXPECTED_CODE_PATH', {
      message: 'Unexpected event type: "bogus"',
      functionName: 'parseEventRow',
      details: { unexpectedValue: 'bogus' },
    });
  });

  it('remaps legacy scheduled_for key to not_before in enqueued payloads', () => {
    const notBefore = getUniqueDate();
    const row = baseRow({
      type: 'enqueued',
      payload: JSON.stringify({
        scheduled_for: notBefore.toISOString(),
        new_wait: DEFAULT_NEW_WAIT,
      }),
    });

    const result = parseEventRow(row);

    expect(result.type).toBe('enqueued');
    expect(result.payload).toStrictEqual({
      not_before: notBefore,
      new_wait: 60,
    });
  });

  it('rejects an enqueued payload missing not_before', () => {
    const row = baseRow({
      type: 'enqueued',
      payload: JSON.stringify({ new_wait: 60 }),
    });
    expect(() => parseEventRow(row)).toThrow();
  });
});

describe('payload length limits', () => {
  it('rejects a retriggered event whose comment URL exceeds the max', () => {
    const row = baseRow({
      type: 'retriggered',
      payload: JSON.stringify({
        source_comment_url: 'a'.repeat(COMMENT_URL_MAX_LENGTH + EXCEEDS_MAX_BY),
        retriggered_comment_url: getUniqueString(),
      }),
    });
    expect(() => parseEventRow(row)).toThrow();
  });

  it('rejects a failed event whose reason exceeds the max', () => {
    const row = baseRow({
      type: 'failed',
      payload: JSON.stringify({
        reason: 'a'.repeat(REASON_MAX_LENGTH + EXCEEDS_MAX_BY),
      }),
    });
    expect(() => parseEventRow(row)).toThrow();
  });

  it('rejects an enqueued event whose new_wait is not a positive integer', () => {
    const row = baseRow({
      type: 'enqueued',
      payload: JSON.stringify({
        not_before: getUniqueDate().toISOString(),
        new_wait: -1,
      }),
    });
    expect(() => parseEventRow(row)).toThrow();
  });
});

describe('EventType discriminator', () => {
  it('uses the literal type strings as payload keys', () => {
    expect(EventType.detected).toBe('detected');
  });
});
