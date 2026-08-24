import { EventType } from '../../src/domain.js';
import { CODERABBIT_RUN_ID_MAX_LENGTH, COMMENT_URL_MAX_LENGTH, parseEventRow, REASON_MAX_LENGTH } from '../../src/schemas/index.js';
import { generateEventHydrationData } from '../helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';
import { z } from 'zod';

const EXCEEDS_MAX_BY = 1;

describe('parseEventRow', () => {
  it('parses a detected event with metadata and request id', () => {
    const sourceTs = getUniqueDate();
    const sourceCommentUrl = getUniqueString();
    const metadata = {
      git_sha: getUniqueString(),
      node_version: getUniqueString(),
    };
    const requestId = getUuid();
    const row = generateEventHydrationData({
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

  it('parses a detected event with coderabbit_run_id', () => {
    const sourceTs = getUniqueDate();
    const sourceCommentUrl = getUniqueString();
    const coderabbitRunId = getUuid();
    const row = generateEventHydrationData({
      type: 'detected',
      payload: JSON.stringify({
        source_ts: sourceTs.toISOString(),
        source_comment_url: sourceCommentUrl,
        coderabbit_run_id: coderabbitRunId,
      }),
    });

    const result = parseEventRow(row);

    expect(result.payload).toStrictEqual({
      source_ts: sourceTs,
      source_comment_url: sourceCommentUrl,
      coderabbit_run_id: coderabbitRunId,
    });
  });

  it('parses an enqueued event', () => {
    const row = generateEventHydrationData({
      type: 'enqueued',
      request_id: null,
      metadata: null,
      payload: JSON.stringify({}),
    });

    const result = parseEventRow(row);

    expect(result.type).toBe('enqueued');
    expect(result.payload).toStrictEqual({});
    expect(result.request_id).toBeUndefined();
    expect(result.metadata).toBeUndefined();
  });

  it('parses a retriggered event', () => {
    const sourceCommentUrl = getUniqueString();
    const retriggeredCommentUrl = getUniqueString();
    const row = generateEventHydrationData({
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

  it('parses a dismissed event', () => {
    const reason = 'prMerged';
    const row = generateEventHydrationData({
      type: 'dismissed',
      payload: JSON.stringify({ reason }),
    });

    const result = parseEventRow(row);

    expect(result.type).toBe('dismissed');
    expect(result.payload).toStrictEqual({ reason: 'prMerged' });
  });

  it('parses a coderabbit_review_approved event', () => {
    const coderabbitCommentUrl = getUniqueString();
    const row = generateEventHydrationData({
      type: 'coderabbit_review_approved',
      payload: JSON.stringify({ coderabbit_comment_url: coderabbitCommentUrl }),
    });

    const result = parseEventRow(row);

    expect(result.type).toBe('coderabbit_review_approved');
    expect(result.payload).toStrictEqual({
      coderabbit_comment_url: coderabbitCommentUrl,
    });
  });

  it('parses a coderabbit_review_approved event with coderabbit_run_id', () => {
    const coderabbitCommentUrl = getUniqueString();
    const coderabbitRunId = getUuid();
    const row = generateEventHydrationData({
      type: 'coderabbit_review_approved',
      payload: JSON.stringify({ coderabbit_comment_url: coderabbitCommentUrl, coderabbit_run_id: coderabbitRunId }),
    });

    const result = parseEventRow(row);

    expect(result.payload).toStrictEqual({
      coderabbit_comment_url: coderabbitCommentUrl,
      coderabbit_run_id: coderabbitRunId,
    });
  });

  it('parses a coderabbit_review_skipped event without coderabbit_run_id', () => {
    const commentUrl = getUniqueString();
    const skipReason = getUniqueString();
    const sourceTs = getUniqueDate();
    const row = generateEventHydrationData({
      type: 'coderabbit_review_skipped',
      payload: JSON.stringify({ source_ts: sourceTs.toISOString(), comment_url: commentUrl, skip_reason: skipReason }),
    });

    const result = parseEventRow(row);

    expect(result.type).toBe('coderabbit_review_skipped');
    expect(result.payload).toStrictEqual({
      source_ts: sourceTs,
      comment_url: commentUrl,
      skip_reason: skipReason,
    });
  });

  it('parses a coderabbit_review_skipped event with coderabbit_run_id', () => {
    const commentUrl = getUniqueString();
    const skipReason = getUniqueString();
    const sourceTs = getUniqueDate();
    const coderabbitRunId = getUuid();
    const row = generateEventHydrationData({
      type: 'coderabbit_review_skipped',
      payload: JSON.stringify({
        source_ts: sourceTs.toISOString(),
        comment_url: commentUrl,
        skip_reason: skipReason,
        coderabbit_run_id: coderabbitRunId,
      }),
    });

    const result = parseEventRow(row);

    expect(result.type).toBe('coderabbit_review_skipped');
    expect(result.payload).toStrictEqual({
      source_ts: sourceTs,
      comment_url: commentUrl,
      skip_reason: skipReason,
      coderabbit_run_id: coderabbitRunId,
    });
  });

  it('parses a coderabbit_run_id_first_seen event', () => {
    const commentUrl = getUniqueString();
    const commentId = getUniqueInt();
    const coderabbitRunId = getUuid();
    const row = generateEventHydrationData({
      type: 'coderabbit_run_id_first_seen',
      payload: JSON.stringify({ comment_id: commentId, comment_url: commentUrl, coderabbit_run_id: coderabbitRunId }),
    });

    const result = parseEventRow(row);

    expect(result.type).toBe('coderabbit_run_id_first_seen');
    expect(result.payload).toStrictEqual({
      comment_id: commentId,
      comment_url: commentUrl,
      coderabbit_run_id: coderabbitRunId,
    });
  });

  it('parses a coderabbit_run_id_changed event', () => {
    const commentUrl = getUniqueString();
    const commentId = getUniqueInt();
    const previousRunId = getUuid();
    const coderabbitRunId = getUuid();
    const row = generateEventHydrationData({
      type: 'coderabbit_run_id_changed',
      payload: JSON.stringify({
        comment_id: commentId,
        comment_url: commentUrl,
        previous_coderabbit_run_id: previousRunId,
        coderabbit_run_id: coderabbitRunId,
      }),
    });

    const result = parseEventRow(row);

    expect(result.type).toBe('coderabbit_run_id_changed');
    expect(result.payload).toStrictEqual({
      comment_id: commentId,
      comment_url: commentUrl,
      previous_coderabbit_run_id: previousRunId,
      coderabbit_run_id: coderabbitRunId,
    });
  });

  it('parses a coderabbit_run_id_cleared event', () => {
    const commentUrl = getUniqueString();
    const commentId = getUniqueInt();
    const previousRunId = getUuid();
    const row = generateEventHydrationData({
      type: 'coderabbit_run_id_cleared',
      payload: JSON.stringify({ comment_id: commentId, comment_url: commentUrl, previous_coderabbit_run_id: previousRunId }),
    });

    const result = parseEventRow(row);

    expect(result.type).toBe('coderabbit_run_id_cleared');
    expect(result.payload).toStrictEqual({
      comment_id: commentId,
      comment_url: commentUrl,
      previous_coderabbit_run_id: previousRunId,
    });
  });

  it('parses a coderabbit_review_changes_suggested event', () => {
    const coderabbitCommentUrl = getUniqueString();
    const row = generateEventHydrationData({
      type: 'coderabbit_review_changes_suggested',
      payload: JSON.stringify({ coderabbit_comment_url: coderabbitCommentUrl }),
    });

    const result = parseEventRow(row);

    expect(result.type).toBe('coderabbit_review_changes_suggested');
    expect(result.payload).toStrictEqual({
      coderabbit_comment_url: coderabbitCommentUrl,
    });
  });

  it('parses a coderabbit_review_changes_suggested event with coderabbit_run_id', () => {
    const coderabbitCommentUrl = getUniqueString();
    const coderabbitRunId = getUuid();
    const row = generateEventHydrationData({
      type: 'coderabbit_review_changes_suggested',
      payload: JSON.stringify({ coderabbit_comment_url: coderabbitCommentUrl, coderabbit_run_id: coderabbitRunId }),
    });

    const result = parseEventRow(row);

    expect(result.payload).toStrictEqual({
      coderabbit_comment_url: coderabbitCommentUrl,
      coderabbit_run_id: coderabbitRunId,
    });
  });

  it('parses a failed event', () => {
    const reason = getUniqueString();
    const row = generateEventHydrationData({
      type: 'failed',
      payload: JSON.stringify({ reason }),
    });

    const result = parseEventRow(row);

    expect(result.type).toBe('failed');
    expect(result.payload).toStrictEqual({ reason });
  });

  it('throws for an unknown event type', () => {
    const row = generateEventHydrationData({ type: 'bogus', payload: '{}' });
    expect(() => parseEventRow(row)).toThrowDetailedError('UNEXPECTED_SWITCH_VALUE', {
      message: 'Unexpected event type: "bogus"',
      functionName: 'parseEventRow',
      details: { unexpectedValue: 'bogus' },
    });
  });
});

describe('payload length limits', () => {
  it('rejects a retriggered event whose comment URL exceeds the max', () => {
    const row = generateEventHydrationData({
      type: 'retriggered',
      payload: JSON.stringify({
        source_comment_url: 'a'.repeat(COMMENT_URL_MAX_LENGTH + EXCEEDS_MAX_BY),
        retriggered_comment_url: getUniqueString(),
      }),
    });
    expect(() => parseEventRow(row)).toThrow(z.ZodError);
  });

  it('rejects a failed event whose reason exceeds the max', () => {
    const row = generateEventHydrationData({
      type: 'failed',
      payload: JSON.stringify({
        reason: 'a'.repeat(REASON_MAX_LENGTH + EXCEEDS_MAX_BY),
      }),
    });
    expect(() => parseEventRow(row)).toThrow(z.ZodError);
  });

  it('rejects a coderabbit_review_skipped event whose coderabbit_run_id exceeds the max', () => {
    const row = generateEventHydrationData({
      type: 'coderabbit_review_skipped',
      payload: JSON.stringify({
        source_ts: getUniqueDate().toISOString(),
        comment_url: getUniqueString(),
        skip_reason: getUniqueString(),
        coderabbit_run_id: 'a'.repeat(CODERABBIT_RUN_ID_MAX_LENGTH + EXCEEDS_MAX_BY),
      }),
    });
    expect(() => parseEventRow(row)).toThrow(z.ZodError);
  });

  it('rejects a coderabbit_review_skipped event whose coderabbit_run_id exceeds the max', () => {
    const row = generateEventHydrationData({
      type: 'coderabbit_review_skipped',
      payload: JSON.stringify({
        source_ts: getUniqueDate().toISOString(),
        comment_url: getUniqueString(),
        skip_reason: getUniqueString(),
        coderabbit_run_id: 'a'.repeat(CODERABBIT_RUN_ID_MAX_LENGTH + EXCEEDS_MAX_BY),
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
