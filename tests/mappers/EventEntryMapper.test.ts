import { BypassReason, EventType } from '../../src/domain.js';
import { EventEntryMapper } from '../../src/mappers/index.js';
import { type DetectedPayload, type EnqueuedPayload, type FailedPayload, type RetriggeredPayload } from '../../src/types/EventPayloads.js';
import type { EventLogEntry } from '../../src/types/index.js';
import { generateReviewRef } from '../../tests/helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('EventEntryMapper', () => {
  const mapper = new EventEntryMapper();

  let ref: ReturnType<typeof generateReviewRef>;
  let id: number;
  let uuid: string;
  let correlationId: string;
  let ts: Date;
  let requestId: string;
  let version: string;

  beforeEach(() => {
    ref = generateReviewRef();
    id = getUniqueInt();
    uuid = getUuid();
    correlationId = getUuid();
    ts = getUniqueDate();
    requestId = getUniqueString({ prefix: 'req-' });
    version = getUniqueString({ prefix: 'version-' });
  });

  const makeDetectedEntry = (): EventLogEntry => ({
    id,
    uuid,
    ts,
    type: EventType.detected,
    repo_full_name: ref.repoFullName,
    pr_number: ref.prNumber,
    correlation_id: correlationId,
    request_id: requestId,
    version,
    payload: { source_comment_url: 'https://gh/c/1' } as DetectedPayload,
  });

  const makeEnqueuedEntry = (): EventLogEntry => ({
    id: id + 1,
    uuid: getUuid(),
    ts,
    type: EventType.enqueued,
    repo_full_name: ref.repoFullName,
    pr_number: ref.prNumber,
    correlation_id: correlationId,
    version,
    payload: {} as EnqueuedPayload,
  });

  const makeRetriggeredEntry = (): EventLogEntry => ({
    id: id + 2,
    uuid: getUuid(),
    ts,
    type: EventType.retriggered,
    repo_full_name: ref.repoFullName,
    pr_number: ref.prNumber,
    correlation_id: correlationId,
    version,
    payload: { source_comment_url: 'https://gh/c/2', retriggered_comment_url: 'https://gh/c/3' } as RetriggeredPayload,
  });

  const makeFailedEntry = (): EventLogEntry => ({
    id: id + 3,
    uuid: getUuid(),
    ts,
    type: EventType.failed,
    repo_full_name: ref.repoFullName,
    pr_number: ref.prNumber,
    correlation_id: correlationId,
    version,
    payload: { reason: 'Rate limited' } as FailedPayload,
  });

  const makeBypassedEntry = (): EventLogEntry => ({
    id: id + 4,
    uuid: getUuid(),
    ts,
    type: EventType.bypassed,
    repo_full_name: ref.repoFullName,
    pr_number: ref.prNumber,
    correlation_id: correlationId,
    version,
    payload: { reason: BypassReason.prMerged },
  });

  describe('mapToEventEntryResponse', () => {
    it('maps shared envelope fields', () => {
      const input = makeDetectedEntry();
      const result = mapper.mapToEventEntryResponse(input);

      expect(result.id).toBe(id);
      expect(result.uuid).toBe(uuid);
      expect(result.repo_full_name).toBe(ref.repoFullName);
      expect(result.pr_number).toBe(ref.prNumber);
      expect(result.correlation_id).toBe(correlationId);
      expect(result.request_id).toBe(requestId);
      expect(result.version).toBe(version);
    });

    it('converts ts Date to ISO string', () => {
      const input = makeDetectedEntry();
      const result = mapper.mapToEventEntryResponse(input);

      expect(result.ts).toBe(ts.toISOString());
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

    it('passes undefined metadata and request_id through', () => {
      const input = makeDetectedEntry();
      const { metadata: _metadata, request_id: _request_id, ...entryWithoutOptionals } = input;
      const result = mapper.mapToEventEntryResponse(entryWithoutOptionals as EventLogEntry);

      expect(result.metadata).toBeUndefined();
      expect(result.request_id).toBeUndefined();
    });

    it('handles enqueued event type', () => {
      const input = makeEnqueuedEntry();
      const result = mapper.mapToEventEntryResponse(input);

      expect(result.type).toBe('enqueued');
      expect(result.payload).toStrictEqual({});
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
