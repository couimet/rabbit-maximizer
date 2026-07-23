import { PrState, QueueStatus, TriggerSource } from '../../src/domain.js';
import { QueueItemMapper } from '../../src/mappers/index.js';
import { buildCommentUrl, createMockQueueItemEnricher, generateEnrichedQueueItemData, generateQueueItemHydrationData } from '../helpers/index.js';

import { getUniqueDate, getUniqueInt } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('QueueItemMapper', () => {
  let mapper: QueueItemMapper;

  beforeEach(() => {
    mapper = new QueueItemMapper(createMockQueueItemEnricher());
  });

  describe('mapToQueueItemResponse', () => {
    it('maps all scalar fields', () => {
      const input = generateEnrichedQueueItemData({
        pr_title: 'Add retrigger dedup logic',
        attempts: 3,
        source_comment_url: buildCommentUrl('org/repo', 1, getUniqueInt()),
        retrigger_comment_url: buildCommentUrl('org/repo', 1, getUniqueInt()),
      });
      const result = mapper.mapToQueueItemResponse(input);

      expect(result.id).toBe(input.id);
      expect(result.uuid).toBe(input.uuid);
      expect(result.repo_full_name).toBe(input.repo_full_name);
      expect(result.pr_number).toBe(input.pr_number);
      expect(result.pr_title).toBe(input.pr_title);
      expect(result.attempts).toBe(input.attempts);
      expect(result.source_comment_url).toBe(input.source_comment_url);
      expect(result.retrigger_comment_url).toBe(input.retrigger_comment_url);
    });

    it('converts Date fields to ISO strings', () => {
      const retriggeredAt = new Date('2026-07-20T10:00:00Z');
      const failedAt = new Date('2026-07-20T11:00:00Z');
      const reviewedAt = new Date('2026-07-20T12:00:00Z');
      const input = generateEnrichedQueueItemData({ retriggered_at: retriggeredAt, failed_at: failedAt, reviewed_at: reviewedAt });
      const result = mapper.mapToQueueItemResponse(input);

      expect(result.created_at).toBe(input.created_at.toISOString());
      expect(result.updated_at).toBe(input.updated_at.toISOString());
      expect(result.retriggered_at).toBe(retriggeredAt.toISOString());
      expect(result.failed_at).toBe(failedAt.toISOString());
      expect(result.reviewed_at).toBe(reviewedAt.toISOString());
    });

    it('converts QueueStatus enum to string', () => {
      const input = generateEnrichedQueueItemData({ status: QueueStatus.reviewed });
      const result = mapper.mapToQueueItemResponse(input);

      expect(result.status).toBe('reviewed');
    });

    it('converts TriggerSource enum to string', () => {
      const input = generateEnrichedQueueItemData({ trigger_source: TriggerSource.dashboard_retrigger_now });
      const result = mapper.mapToQueueItemResponse(input);

      expect(result.trigger_source).toBe('dashboard_retrigger_now');
    });

    it('strips pull_request_id and source_comment_id', () => {
      const input = generateEnrichedQueueItemData();
      const result = mapper.mapToQueueItemResponse(input);

      expect(Object.keys(result)).not.toContain('pull_request_id');
      expect(Object.keys(result)).not.toContain('source_comment_id');
    });

    it('returns null for optional Date fields when absent', () => {
      const input = generateEnrichedQueueItemData();
      const result = mapper.mapToQueueItemResponse(input);

      expect(result.retriggered_at).toBeNull();
      expect(result.failed_at).toBeNull();
      expect(result.reviewed_at).toBeNull();
    });

    it('returns null for retrigger_comment_url when absent', () => {
      const input = generateEnrichedQueueItemData();
      const result = mapper.mapToQueueItemResponse(input);

      expect(result.retrigger_comment_url).toBeNull();
    });

    it('preserves pr_state and last_coderabbit_acknowledged_at', () => {
      const acknowledgedAt = getUniqueDate();
      const input = generateEnrichedQueueItemData({ prState: PrState.merged, lastCoderabbitAcknowledgedAt: acknowledgedAt });
      const result = mapper.mapToQueueItemResponse(input);

      expect(result.pr_state).toBe('merged');
      expect(result.last_coderabbit_acknowledged_at).toBe(acknowledgedAt.toISOString());
    });
  });

  describe('mapToQueueItemResponseList', () => {
    it('maps all items through mapToQueueItemResponse', async () => {
      const items = [generateQueueItemHydrationData(), generateQueueItemHydrationData()];
      const result = await mapper.mapToQueueItemResponseList(items);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(items[0].id);
      expect(result[1].id).toBe(items[1].id);
    });

    it('returns empty array for empty input', async () => {
      expect(await mapper.mapToQueueItemResponseList([])).toStrictEqual([]);
    });
  });
});
