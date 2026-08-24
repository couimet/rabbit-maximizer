import { ExecutionContext } from '../../src/external-deps/couimet/execution-context/src/index.js';
import { EnqueueProbe } from '../../src/probes/index.js';
import { createMockTx } from '../external-deps/couimet/prisma-testing/index.js';
import { createMockEventRepo, generateEventTraceContext, generateReviewRef } from '../helpers/index.js';

import { getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('EnqueueProbe', () => {
  let events: ReturnType<typeof createMockEventRepo>;
  let eventTrace: { correlationId: string; requestId: string; version: string };
  let logger: ReturnType<typeof createMockLogger>;

  const runInContext = <T>(fn: () => Promise<T>): Promise<T> =>
    ExecutionContext.run({ correlationId: eventTrace.correlationId, requestId: eventTrace.requestId, attributes: { version: eventTrace.version } }, fn);

  beforeEach(() => {
    eventTrace = generateEventTraceContext();
    events = createMockEventRepo();
    logger = createMockLogger();
  });

  const createProbe = (tx: ReturnType<typeof createMockTx>) => new EnqueueProbe(events, tx, logger);

  describe('recentlyRetriggered', () => {
    it('logs info with comment ID and run ID when PR was recently retriggered', () => {
      const ref = generateReviewRef();
      const runId = getUniqueString({ prefix: 'run-' });
      const probe = createProbe(createMockTx());
      probe.recentlyRetriggered(ref.repoFullName, ref.prNumber, ref.commentId, runId);
      expect(logger.info).toHaveBeenCalledWith(
        { fn: 'EnqueueProbe.recentlyRetriggered', repo: ref.repoFullName, pr: ref.prNumber, commentId: ref.commentId, coderabbit_run_id: runId },
        'PR was recently retriggered; skipping',
      );
    });

    it('omits the run ID attribute when none is known', () => {
      const ref = generateReviewRef();
      const probe = createProbe(createMockTx());
      probe.recentlyRetriggered(ref.repoFullName, ref.prNumber, ref.commentId, undefined);
      expect(logger.info).toHaveBeenCalledWith(
        { fn: 'EnqueueProbe.recentlyRetriggered', repo: ref.repoFullName, pr: ref.prNumber, commentId: ref.commentId },
        'PR was recently retriggered; skipping',
      );
    });
  });

  describe('retriggeredRunAdopted', () => {
    it('logs info with queue item, comment, previous run, and new run', () => {
      const ref = generateReviewRef();
      const queueItemId = getUniqueInt();
      const previousRunId = getUniqueString({ prefix: 'run-' });
      const runId = getUniqueString({ prefix: 'run-' });
      const probe = createProbe(createMockTx());
      probe.retriggeredRunAdopted(ref.repoFullName, ref.prNumber, queueItemId, ref.commentId, previousRunId, runId);
      expect(logger.info).toHaveBeenCalledWith(
        {
          fn: 'EnqueueProbe.retriggeredRunAdopted',
          repo: ref.repoFullName,
          pr: ref.prNumber,
          queueItemId,
          commentId: ref.commentId,
          previousCoderabbitRunId: previousRunId,
          coderabbit_run_id: runId,
        },
        'Same-comment retriggered item adopted the new CodeRabbit run in place',
      );
    });

    it('omits the previous run attribute when the item had none', () => {
      const ref = generateReviewRef();
      const queueItemId = getUniqueInt();
      const runId = getUniqueString({ prefix: 'run-' });
      const probe = createProbe(createMockTx());
      probe.retriggeredRunAdopted(ref.repoFullName, ref.prNumber, queueItemId, ref.commentId, undefined, runId);
      expect(logger.info).toHaveBeenCalledWith(
        {
          fn: 'EnqueueProbe.retriggeredRunAdopted',
          repo: ref.repoFullName,
          pr: ref.prNumber,
          queueItemId,
          commentId: ref.commentId,
          coderabbit_run_id: runId,
        },
        'Same-comment retriggered item adopted the new CodeRabbit run in place',
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
      await runInContext(() => probe.enqueued({ repo: ref.repoFullName, pr: ref.prNumber }));
      expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
        {
          type: 'enqueued',
          repo_full_name: ref.repoFullName,
          pr_number: ref.prNumber,
          correlation_id: eventTrace.correlationId,
          request_id: eventTrace.requestId,
          version: eventTrace.version,
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
