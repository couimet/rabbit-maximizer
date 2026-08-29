import { CodeRabbitCommentType, PrState, Resolution, ReviewDetectionMethod } from '../../src/domain.js';
import { ExecutionContext } from '../../src/external-deps/couimet/execution-context/src/index.js';
import { ReviewDetectorProbe } from '../../src/probes/index.js';
import { createMockTx } from '../external-deps/couimet/prisma-testing/index.js';
import { createMockEventRepo, generateEventTraceContext, generateQueueItemHydrationData, generateReviewRef } from '../helpers/index.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('ReviewDetectorProbe', () => {
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

  const createProbe = () => new ReviewDetectorProbe(events, logger);

  describe('noRetriggeredItemFound', () => {
    it('logs info when no retriggered items exist', () => {
      const probe = createProbe();
      probe.noRetriggeredItemFound();
      expect(logger.info).toHaveBeenCalledWith({ fn: 'ReviewDetectorProbe.noRetriggeredItemFound' }, 'No retriggered items to check');
    });
  });

  describe('noCompletedReviewFound', () => {
    it('logs debug when no completed review is found', () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const probe = createProbe();
      probe.withItem(item);
      probe.noCompletedReviewFound();
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'ReviewDetectorProbe.noCompletedReviewFound', repo: ref.repoFullName, pr: ref.prNumber, queueId: item.id },
        'No completed review found; will retry on next tick',
      );
    });
  });

  describe('reviewedViaFallback', () => {
    it('records coderabbit_review_approved event with fallback payload and logs info', async () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const tx = createMockTx();
      const probe = createProbe();
      probe.withItem(item);
      await runInContext(() => probe.reviewedViaFallback(tx));
      expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
        {
          type: 'coderabbit_review_approved',
          repo_full_name: ref.repoFullName,
          pr_number: ref.prNumber,
          correlation_id: eventTrace.correlationId,
          request_id: eventTrace.requestId,
          version: eventTrace.version,
          payload: { detected_via: 'last_coderabbit_review_at_fallback' },
        },
        tx,
      );
      expect(logger.info).toHaveBeenCalledWith(
        { fn: 'ReviewDetectorProbe.reviewedViaFallback', repo: ref.repoFullName, pr: ref.prNumber, queueId: item.id },
        'Review detected via last_coderabbit_review_at fallback',
      );
    });
  });

  describe('reviewed', () => {
    it('records coderabbit_review_approved event with coderabbit_comment_url and logs info', async () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const commentUrl = getUniqueString({ prefix: 'https://gh/c/posted-' });
      const tx = createMockTx();
      const probe = createProbe();
      probe.withItem(item);
      await runInContext(() => probe.reviewed(commentUrl, CodeRabbitCommentType.review_approved, ReviewDetectionMethod.EditDetection, tx));
      expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
        {
          type: 'coderabbit_review_approved',
          repo_full_name: ref.repoFullName,
          pr_number: ref.prNumber,
          correlation_id: eventTrace.correlationId,
          request_id: eventTrace.requestId,
          version: eventTrace.version,
          payload: { coderabbit_comment_url: commentUrl, verdict_state: 'review_approved', detected_via: 'edit_detection' },
        },
        tx,
      );
      expect(logger.info).toHaveBeenCalledWith(
        { fn: 'ReviewDetectorProbe.reviewed', repo: ref.repoFullName, pr: ref.prNumber, queueId: item.id, eventType: 'coderabbit_review_approved', commentUrl },
        'Review detected',
      );
    });
  });

  describe('prClosedResolved', () => {
    it('logs info with merged prState', () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const probe = createProbe();
      probe.withItem(item);
      probe.prClosedResolved(PrState.merged);
      expect(logger.info).toHaveBeenCalledWith(
        { fn: 'ReviewDetectorProbe.prClosedResolved', repo: ref.repoFullName, pr: ref.prNumber, queueId: item.id, prState: 'merged' },
        'PR is closed or merged; auto-resolving retriggered queue item',
      );
    });

    it('logs info with closed prState', () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const probe = createProbe();
      probe.withItem(item);
      probe.prClosedResolved(PrState.closed);
      expect(logger.info).toHaveBeenCalledWith(
        { fn: 'ReviewDetectorProbe.prClosedResolved', repo: ref.repoFullName, pr: ref.prNumber, queueId: item.id, prState: 'closed' },
        'PR is closed or merged; auto-resolving retriggered queue item',
      );
    });
  });

  describe('prClosedResolved', () => {
    it('logs info with merged prState', () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const probe = createProbe();
      probe.withItem(item);
      probe.prClosedResolved(PrState.merged);
      expect(logger.info).toHaveBeenCalledWith(
        { fn: 'ReviewDetectorProbe.prClosedResolved', repo: ref.repoFullName, pr: ref.prNumber, queueId: item.id, prState: 'merged' },
        'PR is closed or merged; auto-resolving retriggered queue item',
      );
    });

    it('logs info with closed prState', () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const probe = createProbe();
      probe.withItem(item);
      probe.prClosedResolved(PrState.closed);
      expect(logger.info).toHaveBeenCalledWith(
        { fn: 'ReviewDetectorProbe.prClosedResolved', repo: ref.repoFullName, pr: ref.prNumber, queueId: item.id, prState: 'closed' },
        'PR is closed or merged; auto-resolving retriggered queue item',
      );
    });
  });

  describe('resolutionLostRace', () => {
    it('logs warn with item context and resolution', () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const probe = createProbe();
      probe.withItem(item);
      probe.resolutionLostRace(Resolution.ReviewCompleted);
      expect(logger.warn).toHaveBeenCalledWith(
        { fn: 'ReviewDetectorProbe.resolutionLostRace', repo: ref.repoFullName, pr: ref.prNumber, queueId: item.id, resolution: 'review_completed' },
        'Item was no longer retriggered; another writer resolved it first — skipping resolution',
      );
    });
  });

  describe('runAdopted', () => {
    it('logs info with item context and run id', () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const runId = getUniqueString({ prefix: 'run-' });
      const probe = createProbe();
      probe.withItem(item);
      probe.runAdopted(runId);
      expect(logger.info).toHaveBeenCalledWith(
        { fn: 'ReviewDetectorProbe.runAdopted', repo: ref.repoFullName, pr: ref.prNumber, queueId: item.id, runId },
        'Re-edited skip comment adopted a new CodeRabbit run in place',
      );
    });
  });

  describe('runAdoptionLostRace', () => {
    it('logs warn with item context and run id', () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const runId = getUniqueString({ prefix: 'run-' });
      const probe = createProbe();
      probe.withItem(item);
      probe.runAdoptionLostRace(runId);
      expect(logger.warn).toHaveBeenCalledWith(
        { fn: 'ReviewDetectorProbe.runAdoptionLostRace', repo: ref.repoFullName, pr: ref.prNumber, queueId: item.id, runId },
        'Run adoption lost the race; the item was resolved or its run changed',
      );
    });
  });

  describe('editDetectionFailed', () => {
    it('logs warn with item context and error when edit detection fails', () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const detectionError = new Error('fetchComment failed');
      const probe = createProbe();
      probe.withItem(item);
      probe.editDetectionFailed(detectionError);
      expect(logger.warn).toHaveBeenCalledWith(
        { fn: 'ReviewDetectorProbe.editDetectionFailed', repo: ref.repoFullName, pr: ref.prNumber, queueId: item.id, error: detectionError },
        'Edit detection failed; skipping retrigger check for this item',
      );
    });
  });

  describe('caughtError', () => {
    it('logs warn with item context and error', () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const tickError = new Error('API unavailable');
      const probe = createProbe();
      probe.withItem(item);
      probe.caughtError(tickError);
      expect(logger.warn).toHaveBeenCalledWith(
        { fn: 'ReviewDetectorProbe.caughtError', repo: ref.repoFullName, pr: ref.prNumber, queueId: item.id, error: tickError },
        'Review detection tick failed; will retry on next interval',
      );
    });
  });
});
