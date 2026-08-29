import { type QueueStatus, type Resolution, type SkipReason, type TriggerSource } from '../../src/domain.js';
import { ReviewQueueToQueueItemMapper } from '../../src/mappers/index.js';
import type { QueueItem } from '../../src/types/index.js';
import { sqlDateToDate } from '../../src/utils/index.js';
import { generateReviewQueueHydrationData, generateReviewRef } from '../helpers/index.js';

import { getUniqueDate, getUniqueInt } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

describe('ReviewQueueToQueueItemMapper', () => {
  const mapper = new ReviewQueueToQueueItemMapper();

  describe('fromReviewQueue', () => {
    it('maps all scalar fields', () => {
      const row = generateReviewQueueHydrationData();
      const result = mapper.fromReviewQueue(row);

      expect(result.id).toBe(row.id);
      expect(result.uuid).toBe(row.uuid);
      expect(result.repo_full_name).toBe(row.repo_full_name);
      expect(result.pr_number).toBe(row.pr_number);
      expect(result.pr_title).toBe(row.pr_title);
      expect(result.attempts).toBe(row.attempts);
      expect(result.source_comment_url).toBe(row.source_comment_url);
      expect(result.source_comment_id).toBe(row.source_comment_id);
      expect(result.created_at).toBe(row.created_at);
      expect(result.updated_at).toBe(row.updated_at);
    });

    it('casts status to QueueStatus', () => {
      const row = generateReviewQueueHydrationData({ status: 'resolved' as QueueStatus });
      const result = mapper.fromReviewQueue(row);

      expect(result.status).toBe('resolved');
    });

    it('casts trigger_source to TriggerSource', () => {
      const row = generateReviewQueueHydrationData({ trigger_source: 'scheduler' as TriggerSource });
      const result = mapper.fromReviewQueue(row);

      expect(result.trigger_source).toBe('scheduler');
    });

    it('converts null timestamps and nullable fields to undefined', () => {
      const row = generateReviewQueueHydrationData({
        retriggered_at: null as unknown as Date,
        failed_at: null as unknown as Date,
        reviewed_at: null as unknown as Date,
        resolved_at: null as unknown as Date,
        resolution: null as unknown as string,
        source_comment_run_id: null as unknown as string,
      });

      const result = mapper.fromReviewQueue(row);

      expect(result.retriggered_at).toBeUndefined();
      expect(result.failed_at).toBeUndefined();
      expect(result.reviewed_at).toBeUndefined();
      expect(result.resolved_at).toBeUndefined();
      expect(result.resolution).toBeUndefined();
      expect(result.source_comment_run_id).toBeUndefined();
    });

    it('preserves non-null timestamps as Date objects', () => {
      const retriggeredAt = getUniqueDate();
      const failedAt = getUniqueDate();
      const reviewedAt = getUniqueDate();
      const resolvedAt = getUniqueDate();
      const row = generateReviewQueueHydrationData({
        retriggered_at: retriggeredAt,
        failed_at: failedAt,
        reviewed_at: reviewedAt,
        resolved_at: resolvedAt,
        resolution: 'review_completed' as unknown as string,
      });

      const result = mapper.fromReviewQueue(row);

      expect(result.retriggered_at).toBe(retriggeredAt);
      expect(result.failed_at).toBe(failedAt);
      expect(result.reviewed_at).toBe(reviewedAt);
      expect(result.resolved_at).toBe(resolvedAt);
      expect(result.resolution).toBe('review_completed');
    });

    it('converts null retrigger_comment_url to undefined', () => {
      const row = generateReviewQueueHydrationData({ retrigger_comment_url: null as unknown as string });
      const result = mapper.fromReviewQueue(row);

      expect(result.retrigger_comment_url).toBeUndefined();
    });

    it('preserves non-null retrigger_comment_url', () => {
      const ref = generateReviewRef();
      const url = ref.commentUrl;
      const row = generateReviewQueueHydrationData({ retrigger_comment_url: url });
      const result = mapper.fromReviewQueue(row);

      expect(result.retrigger_comment_url).toBe(url);
    });

    it('preserves non-null original_source_comment_url', () => {
      const originalUrl = 'https://github.com/owner/repo/issues/1#issuecomment-123';
      const row = generateReviewQueueHydrationData({ original_source_comment_url: originalUrl });
      const result = mapper.fromReviewQueue(row);

      expect(result.original_source_comment_url).toBe(originalUrl);
    });

    it('uses non-null assertion on pull_request_id', () => {
      const pullRequestId = getUniqueInt();
      const row = generateReviewQueueHydrationData({ pull_request_id: pullRequestId });
      const result = mapper.fromReviewQueue(row);

      expect(result.pull_request_id).toBe(pullRequestId);
    });

    it('does not set pr_state or last_coderabbit_acknowledged_at (populated later by enricher)', () => {
      const row = generateReviewQueueHydrationData();
      const result = mapper.fromReviewQueue(row);

      expect(Object.keys(result)).not.toContain('pr_state');
      expect(Object.keys(result)).not.toContain('last_coderabbit_acknowledged_at');
    });

    it('produces a QueueItem with the expected shape', () => {
      const row = generateReviewQueueHydrationData();
      const result = mapper.fromReviewQueue(row);

      const expected: QueueItem = {
        id: row.id,
        uuid: row.uuid,
        repo_full_name: row.repo_full_name,
        pr_number: row.pr_number,
        pr_title: row.pr_title,
        status: row.status as QueueStatus,
        attempts: row.attempts,
        source_comment_url: row.source_comment_url,
        source_comment_id: row.source_comment_id,
        source_comment_run_id: row.source_comment_run_id ?? undefined,
        original_source_comment_url: row.original_source_comment_url ?? undefined,
        trigger_source: row.trigger_source as TriggerSource,
        retrigger_comment_url: row.retrigger_comment_url ?? undefined,
        retriggered_at: sqlDateToDate(row.retriggered_at),
        cooldown_until: sqlDateToDate(row.cooldown_until),
        last_skipped_at: sqlDateToDate(row.last_skipped_at),
        last_skip_reason: (row.last_skip_reason as SkipReason) ?? undefined,
        retrigger_skip_count: row.retrigger_skip_count,
        failed_at: sqlDateToDate(row.failed_at),
        reviewed_at: sqlDateToDate(row.reviewed_at),
        resolved_at: sqlDateToDate(row.resolved_at),
        resolution: (row.resolution as Resolution) ?? undefined,
        pull_request_id: row.pull_request_id!,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };

      expect(result).toStrictEqual(expected);
    });
  });
});
