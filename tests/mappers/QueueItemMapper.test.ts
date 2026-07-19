import { QueueItemMapper } from '../../src/mappers/QueueItemMapper.js';
import { QueueStatus, TriggerSource } from '../../src/types/index.js';
import type { QueueItem } from '../../src/types/QueueItem.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUuid } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

const STATUS = QueueStatus.pending;
const TRIGGER_SOURCE = TriggerSource.scheduler;
const REPO = getUniqueGitHubRepoRef().fullName;
const PR_NUMBER = getUniqueInt();
const UUID = getUuid();
const ID = getUniqueInt();
const PR_TITLE = 'Add retrigger dedup logic';
const ATTEMPTS = 3;
const SOURCE_COMMENT_URL = 'https://github.com/org/repo/issues/1#issuecomment-123';
const RETRIGGER_COMMENT_URL = 'https://github.com/org/repo/issues/1#issuecomment-456';
const NOW = getUniqueDate();
const CREATED_AT = new Date(NOW.getTime() - 86_400_000);
const UPDATED_AT = new Date(NOW.getTime() - 3_600_000);
const RETRIGGERED_AT = new Date(NOW.getTime() - 1_800_000);
const FAILED_AT = new Date(NOW.getTime() - 900_000);
const REVIEWED_AT = new Date(NOW.getTime() - 600_000);

const makeQueueItem = (overrides: Partial<QueueItem> = {}): QueueItem => ({
  id: ID,
  uuid: UUID,
  repo_full_name: REPO,
  pr_number: PR_NUMBER,
  pr_title: PR_TITLE,
  status: STATUS,
  attempts: ATTEMPTS,
  source_comment_url: SOURCE_COMMENT_URL,
  source_comment_id: getUniqueInt(),
  trigger_source: TRIGGER_SOURCE,
  retrigger_comment_url: RETRIGGER_COMMENT_URL,
  retriggered_at: RETRIGGERED_AT,
  failed_at: FAILED_AT,
  reviewed_at: REVIEWED_AT,
  pull_request_id: getUniqueInt(),
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
  ...overrides,
});

describe('QueueItemMapper', () => {
  const mapper = new QueueItemMapper();

  describe('mapToQueueItemResponse', () => {
    it('maps all scalar fields', () => {
      const input = makeQueueItem();
      const result = mapper.mapToQueueItemResponse(input);

      expect(result.id).toBe(ID);
      expect(result.uuid).toBe(UUID);
      expect(result.repo_full_name).toBe(REPO);
      expect(result.pr_number).toBe(PR_NUMBER);
      expect(result.pr_title).toBe(PR_TITLE);
      expect(result.attempts).toBe(ATTEMPTS);
      expect(result.source_comment_url).toBe(SOURCE_COMMENT_URL);
      expect(result.retrigger_comment_url).toBe(RETRIGGER_COMMENT_URL);
    });

    it('converts Date fields to ISO strings', () => {
      const input = makeQueueItem();
      const result = mapper.mapToQueueItemResponse(input);

      expect(result.created_at).toBe(CREATED_AT.toISOString());
      expect(result.updated_at).toBe(UPDATED_AT.toISOString());
      expect(result.retriggered_at).toBe(RETRIGGERED_AT.toISOString());
      expect(result.failed_at).toBe(FAILED_AT.toISOString());
      expect(result.reviewed_at).toBe(REVIEWED_AT.toISOString());
    });

    it('converts QueueStatus enum to string', () => {
      const input = makeQueueItem({ status: QueueStatus.reviewed });
      const result = mapper.mapToQueueItemResponse(input);

      expect(result.status).toBe('reviewed');
    });

    it('converts TriggerSource enum to string', () => {
      const input = makeQueueItem({ trigger_source: TriggerSource.dashboard_retrigger_now });
      const result = mapper.mapToQueueItemResponse(input);

      expect(result.trigger_source).toBe('dashboard_retrigger_now');
    });

    it('strips pull_request_id and source_comment_id', () => {
      const input = makeQueueItem();
      const result = mapper.mapToQueueItemResponse(input);

      expect(Object.keys(result)).not.toContain('pull_request_id');
      expect(Object.keys(result)).not.toContain('source_comment_id');
    });

    it('returns undefined for optional Date fields when absent', () => {
      const input = makeQueueItem({
        retriggered_at: undefined,
        failed_at: undefined,
        reviewed_at: undefined,
      });
      const result = mapper.mapToQueueItemResponse(input);

      expect(result.retriggered_at).toBeUndefined();
      expect(result.failed_at).toBeUndefined();
      expect(result.reviewed_at).toBeUndefined();
    });

    it('returns undefined for retrigger_comment_url when absent', () => {
      const input = makeQueueItem({ retrigger_comment_url: undefined });
      const result = mapper.mapToQueueItemResponse(input);

      expect(result.retrigger_comment_url).toBeUndefined();
    });
  });

  describe('mapToQueueItemResponseList', () => {
    it('maps all items through mapToQueueItemResponse', () => {
      const items = [makeQueueItem(), makeQueueItem({ id: ID + 1, uuid: getUuid() })];
      const result = mapper.mapToQueueItemResponseList(items);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(ID);
      expect(result[1].id).toBe(ID + 1);
    });

    it('returns empty array for empty input', () => {
      expect(mapper.mapToQueueItemResponseList([])).toStrictEqual([]);
    });
  });
});
