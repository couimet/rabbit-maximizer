import { EventEntryMapper } from '../../src/mappers/EventEntryMapper.js';
import type { EventLogEntry } from '../../src/types/EventLogEntry.js';
import { BypassReason, type DetectedPayload, type EnqueuedPayload, type FailedPayload, type RetriggeredPayload } from '../../src/types/EventPayloads.js';
import { EventType } from '../../src/types/EventType.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUuid } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

const REPO = getUniqueGitHubRepoRef().fullName;
const PR_NUMBER = getUniqueInt();
const ID = getUniqueInt();
const UUID = getUuid();
const CORRELATION_ID = getUuid();
const TS = getUniqueDate();
const REQUEST_ID = 'req-abc-123';
const VERSION = '1.0.0';

const makeDetectedEntry = (): EventLogEntry => ({
  id: ID,
  uuid: UUID,
  ts: TS,
  type: EventType.detected,
  repo_full_name: REPO,
  pr_number: PR_NUMBER,
  correlation_id: CORRELATION_ID,
  request_id: REQUEST_ID,
  version: VERSION,
  payload: { source_comment_url: 'https://gh/c/1' } as DetectedPayload,
});

const makeEnqueuedEntry = (): EventLogEntry => ({
  id: ID + 1,
  uuid: getUuid(),
  ts: TS,
  type: EventType.enqueued,
  repo_full_name: REPO,
  pr_number: PR_NUMBER,
  correlation_id: CORRELATION_ID,
  version: VERSION,
  payload: { not_before: TS, new_wait: 42 } as EnqueuedPayload,
});

const makeRetriggeredEntry = (): EventLogEntry => ({
  id: ID + 2,
  uuid: getUuid(),
  ts: TS,
  type: EventType.retriggered,
  repo_full_name: REPO,
  pr_number: PR_NUMBER,
  correlation_id: CORRELATION_ID,
  version: VERSION,
  payload: { source_comment_url: 'https://gh/c/2', retriggered_comment_url: 'https://gh/c/3' } as RetriggeredPayload,
});

const makeFailedEntry = (): EventLogEntry => ({
  id: ID + 3,
  uuid: getUuid(),
  ts: TS,
  type: EventType.failed,
  repo_full_name: REPO,
  pr_number: PR_NUMBER,
  correlation_id: CORRELATION_ID,
  version: VERSION,
  payload: { reason: 'Rate limited' } as FailedPayload,
});

const makeBypassedEntry = (): EventLogEntry => ({
  id: ID + 4,
  uuid: getUuid(),
  ts: TS,
  type: EventType.bypassed,
  repo_full_name: REPO,
  pr_number: PR_NUMBER,
  correlation_id: CORRELATION_ID,
  version: VERSION,
  payload: { reason: BypassReason.prMerged },
});

describe('EventEntryMapper', () => {
  const mapper = new EventEntryMapper();

  describe('mapToEventEntryResponse', () => {
    it('maps shared envelope fields', () => {
      const input = makeDetectedEntry();
      const result = mapper.mapToEventEntryResponse(input);

      expect(result.id).toBe(ID);
      expect(result.uuid).toBe(UUID);
      expect(result.repo_full_name).toBe(REPO);
      expect(result.pr_number).toBe(PR_NUMBER);
      expect(result.correlation_id).toBe(CORRELATION_ID);
      expect(result.request_id).toBe(REQUEST_ID);
      expect(result.version).toBe(VERSION);
    });

    it('converts ts Date to ISO string', () => {
      const input = makeDetectedEntry();
      const result = mapper.mapToEventEntryResponse(input);

      expect(result.ts).toBe(TS.toISOString());
    });

    it('converts EventType enum to string', () => {
      const input = makeDetectedEntry();
      const result = mapper.mapToEventEntryResponse(input);

      expect(result.type).toBe('detected');
    });

    it('passes payload through', () => {
      const input = makeDetectedEntry();
      const result = mapper.mapToEventEntryResponse(input);

      expect(result.payload).toStrictEqual({ source_comment_url: 'https://gh/c/1' });
    });

    it('handles metadata when present', () => {
      const metadata = { git_sha: 'abc123', build_id: '456' };
      const input = { ...makeDetectedEntry(), metadata };
      const result = mapper.mapToEventEntryResponse(input);

      expect(result.metadata).toStrictEqual(metadata);
    });

    it('handles enqueued event type', () => {
      const input = makeEnqueuedEntry();
      const result = mapper.mapToEventEntryResponse(input);

      expect(result.type).toBe('enqueued');
      expect(result.payload).toStrictEqual({ not_before: TS, new_wait: 42 });
    });

    it('handles retriggered event type', () => {
      const input = makeRetriggeredEntry();
      const result = mapper.mapToEventEntryResponse(input);

      expect(result.type).toBe('retriggered');
    });

    it('handles failed event type', () => {
      const input = makeFailedEntry();
      const result = mapper.mapToEventEntryResponse(input);

      expect(result.type).toBe('failed');
      expect(result.payload).toStrictEqual({ reason: 'Rate limited' });
    });

    it('handles bypassed event type', () => {
      const input = makeBypassedEntry();
      const result = mapper.mapToEventEntryResponse(input);

      expect(result.type).toBe('bypassed');
      expect(result.payload).toStrictEqual({ reason: 'prMerged' });
    });
  });

  describe('mapToEventEntryResponseList', () => {
    it('maps all items through mapToEventEntryResponse', () => {
      const items = [makeDetectedEntry(), makeEnqueuedEntry()];
      const result = mapper.mapToEventEntryResponseList(items);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('detected');
      expect(result[1].type).toBe('enqueued');
    });

    it('returns empty array for empty input', () => {
      expect(mapper.mapToEventEntryResponseList([])).toStrictEqual([]);
    });
  });
});
