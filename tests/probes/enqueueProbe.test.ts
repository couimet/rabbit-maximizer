import { ObservationContext } from '../../src/observability/index.js';
import { EnqueueProbe } from '../../src/probes/index.js';
import { createMockTx } from '../external-deps/couimet/prisma-testing/index.js';
import { createMockEventRepo, generateObservationContextHydrationData, generateReviewRef } from '../helpers/index.js';

import { getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('EnqueueProbe', () => {
  let events: ReturnType<typeof createMockEventRepo>;
  let logger: ReturnType<typeof createMockLogger>;
  let observation: ObservationContext;

  beforeEach(() => {
    events = createMockEventRepo();
    logger = createMockLogger();
    observation = generateObservationContextHydrationData();
  });

  const createProbe = (tx: ReturnType<typeof createMockTx>) => new EnqueueProbe(events, observation, tx, logger);

  describe('recentlyRetriggered', () => {
    it('logs info when PR was recently retriggered', () => {
      const ref = generateReviewRef();
      const probe = createProbe(createMockTx());
      probe.recentlyRetriggered(ref.repoFullName, ref.prNumber);
      expect(logger.info).toHaveBeenCalledWith(
        { fn: 'EnqueueProbe.recentlyRetriggered', repo: ref.repoFullName, pr: ref.prNumber },
        'PR was recently retriggered; skipping',
      );
    });
  });

  describe('recentlyResolved', () => {
    it('logs warn (loop detection) when resolved within 5 minutes', () => {
      const ref = generateReviewRef();
      const existingUuid = getUuid();
      const probe = createProbe(createMockTx());
      const resolvedAt = new Date();
      probe.recentlyResolved(ref.repoFullName, ref.prNumber, existingUuid, ref.commentId, resolvedAt);
      expect(logger.warn).toHaveBeenCalledWith(
        {
          fn: 'EnqueueProbe.recentlyResolved',
          repo: ref.repoFullName,
          pr: ref.prNumber,
          existingUuid,
          sourceCommentId: ref.commentId,
          elapsedMs: expect.any(Number) as number,
        },
        'Loop detected: same source_comment_id re-enqueued within guard window',
      );
    });
  });

  describe('enqueued', () => {
    const eventUuid = getUuid();
    it('records enqueued event and logs info with event uuid', async () => {
      const ref = generateReviewRef();
      const tx = createMockTx();
      const probe = createProbe(tx);
      (events.record as jest.Mock<any>).mockResolvedValue({ uuid: eventUuid });
      await probe.enqueued({ repo: ref.repoFullName, pr: ref.prNumber });
      expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
        {
          type: 'enqueued',
          repo_full_name: ref.repoFullName,
          pr_number: ref.prNumber,
          correlation_id: observation.correlationId,
          request_id: observation.requestId,
          version: observation.version,
          payload: {},
        },
        tx,
      );
      expect(logger.info).toHaveBeenCalledWith(
        { fn: 'EnqueueProbe.enqueued', repo: ref.repoFullName, pr: ref.prNumber, eventUuid: eventUuid },
        'Queue item enqueued',
      );
    });
  });

  describe('alreadyQueued', () => {
    it('logs debug when PR is already queued', () => {
      const ref = generateReviewRef();
      const statusValue = getUniqueString({ prefix: 'status-' });
      const probe = createProbe(createMockTx());
      probe.alreadyQueued(ref.repoFullName, ref.prNumber, statusValue);
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'EnqueueProbe.alreadyQueued', repo: ref.repoFullName, pr: ref.prNumber, status: statusValue },
        'Already queued; returning existing row',
      );
    });
  });

  describe('retriggeredReplaced', () => {
    it('logs info with old and new comment IDs', () => {
      const ref = generateReviewRef();
      const oldCommentId = getUniqueInt();
      const newCommentId = getUniqueInt();
      const probe = createProbe(createMockTx());
      probe.retriggeredReplaced(ref.repoFullName, ref.prNumber, oldCommentId, newCommentId);
      expect(logger.info).toHaveBeenCalledWith(
        { fn: 'EnqueueProbe.retriggeredReplaced', repo: ref.repoFullName, pr: ref.prNumber, oldCommentId: oldCommentId, newCommentId: newCommentId },
        'Recycled review-limit comment detected; updating retriggered item source comment to prevent duplicate items',
      );
    });
  });

  describe('retriggeredReplaced', () => {
    it('logs info with old and new comment IDs', () => {
      const ref = generateReviewRef();
      const oldCommentId = getUniqueInt();
      const newCommentId = getUniqueInt();
      const probe = createProbe(createMockTx());
      probe.retriggeredReplaced(ref.repoFullName, ref.prNumber, oldCommentId, newCommentId);
      expect(logger.info).toHaveBeenCalledWith(
        { fn: 'EnqueueProbe.retriggeredReplaced', repo: ref.repoFullName, pr: ref.prNumber, oldCommentId: oldCommentId, newCommentId: newCommentId },
        'Recycled review-limit comment detected; updating retriggered item source comment to prevent duplicate items',
      );
    });
  });
});
