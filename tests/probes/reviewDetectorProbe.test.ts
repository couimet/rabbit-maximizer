import { EventType, PrState } from '../../src/domain.js';
import type { ObservationContext } from '../../src/observability/index.js';
import { ReviewDetectorProbe } from '../../src/probes/index.js';
import { createMockTx } from '../external-deps/couimet/prisma-testing/index.js';
import { createMockEventRepo, generateObservationContextHydrationData, generateQueueItemHydrationData, generateReviewRef } from '../helpers/index.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('ReviewDetectorProbe', () => {
  let events: ReturnType<typeof createMockEventRepo>;
  let logger: ReturnType<typeof createMockLogger>;
  let observation: ObservationContext;

  beforeEach(() => {
    events = createMockEventRepo();
    logger = createMockLogger();
    observation = generateObservationContextHydrationData();
  });

  const createProbe = () => new ReviewDetectorProbe(events, observation, logger);

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

  describe('reviewed', () => {
    it('records coderabbit_review_approved event with coderabbit_comment_url and logs info', async () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const commentUrl = getUniqueString({ prefix: 'https://gh/c/posted-' });
      const tx = createMockTx();
      const probe = createProbe();
      probe.withItem(item);
      await probe.reviewed(EventType.coderabbit_review_approved, commentUrl, tx);
      expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
        {
          type: 'coderabbit_review_approved',
          repo_full_name: ref.repoFullName,
          pr_number: ref.prNumber,
          correlation_id: observation.correlationId,
          request_id: observation.requestId,
          version: observation.version,
          payload: { coderabbit_comment_url: commentUrl },
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
