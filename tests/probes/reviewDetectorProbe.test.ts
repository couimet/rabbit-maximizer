import type { EventRepository } from '../../src/db/eventRepository.js';
import type { CompletedReview } from '../../src/github/types/CompletedReview.js';
import type { ObservationContext } from '../../src/observability/observationContext.js';
import { ReviewDetectorProbe } from '../../src/probes/ReviewDetectorProbe.js';
import type { QueueItem } from '../../src/types/index.js';

import { getUniqueGitHubRepoRef, getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Prisma } from '@prisma/client';

const makeTx = (): Prisma.TransactionClient => ({}) as Prisma.TransactionClient;
const makeItem = (repo: string, pr: number): QueueItem =>
  ({ id: getUniqueInt(), repo_full_name: repo, pr_number: pr, source_comment_url: getUniqueString({ prefix: 'https://gh/c/' }) }) as unknown as QueueItem;

describe('ReviewDetectorProbe', () => {
  let events: EventRepository;
  let logger: Logger;
  let observation: ObservationContext;

  beforeEach(() => {
    events = { record: jest.fn<any>() } as unknown as EventRepository;
    logger = createMockLogger();
    observation = { correlationId: getUuid(), requestId: getUuid(), version: '1.0.0' };
  });

  const createProbe = () => new ReviewDetectorProbe(events, observation, logger);

  describe('noRetriggeredItemFound', () => {
    it('logs info when no retriggered items exist', () => {
      const probe = createProbe();
      probe.noRetriggeredItemFound();
      expect(logger.info as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'ReviewDetectorProbe.noRetriggeredItemFound' }, 'No retriggered items to check');
    });
  });

  describe('noCompletedReviewFound', () => {
    it('logs debug when no completed review is found', () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const item = makeItem(repo, pr);
      const probe = createProbe();
      probe.withItem(item);
      probe.noCompletedReviewFound();
      expect(logger.debug as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'ReviewDetectorProbe.noCompletedReviewFound', repo, pr, queueId: item.id },
        'No completed review found; will retry on next tick',
      );
    });
  });

  describe('completed', () => {
    it('records completed event with full review payload and logs info', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const item = makeItem(repo, pr);
      const htmlUrl = getUniqueString({ prefix: 'https://gh/c/posted-' });
      const reviewId = getUniqueInt();
      const completedReview: CompletedReview = { htmlUrl, reviewId };
      const tx = makeTx();
      const probe = createProbe();
      probe.withItem(item);
      await probe.completed(completedReview, tx);
      expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
        {
          type: 'completed',
          repo_full_name: repo,
          pr_number: pr,
          correlation_id: observation.correlationId,
          request_id: observation.requestId,
          version: observation.version,
          payload: { retriggered_comment_url: htmlUrl, review_id: reviewId },
        },
        tx,
      );
      expect(logger.info as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'ReviewDetectorProbe.completed', repo, pr, queueId: item.id, reviewUrl: htmlUrl, reviewId },
        'Completed review detected',
      );
    });
  });

  describe('caughtError', () => {
    it('logs warn with item context and error', () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const item = makeItem(repo, pr);
      const tickError = new Error('API unavailable');
      const probe = createProbe();
      probe.withItem(item);
      probe.caughtError(tickError);
      expect(logger.warn as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'ReviewDetectorProbe.caughtError', repo, pr, queueId: item.id, error: tickError },
        'Review detection tick failed; will retry on next interval',
      );
    });
  });
});
