import type { ObservationContext } from '../../src/observability/observationContext.js';
import { ReviewDetectorProbe } from '../../src/probes/ReviewDetectorProbe.js';
import { EventType, type QueueItem } from '../../src/types/index.js';
import { createMockEventRepo, createMockObservationContext } from '../helpers/index.js';

import { getUniqueGitHubRepoRef, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Prisma } from '@prisma/client';

const makeTx = (): Prisma.TransactionClient => ({}) as Prisma.TransactionClient;
const makeItem = (repo: string, pr: number): QueueItem =>
  ({ id: getUniqueInt(), repo_full_name: repo, pr_number: pr, source_comment_url: getUniqueString({ prefix: 'https://gh/c/' }) }) as unknown as QueueItem;

describe('ReviewDetectorProbe', () => {
  let events: ReturnType<typeof createMockEventRepo>;
  let logger: Logger;
  let observation: ObservationContext;

  beforeEach(() => {
    events = createMockEventRepo();
    logger = createMockLogger();
    observation = createMockObservationContext();
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

  describe('reviewed', () => {
    it('records coderabbit_review_approved event with coderabbit_comment_url and logs info', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const item = makeItem(repo, pr);
      const commentUrl = getUniqueString({ prefix: 'https://gh/c/posted-' });
      const tx = makeTx();
      const probe = createProbe();
      probe.withItem(item);
      await probe.reviewed(EventType.coderabbit_review_approved, commentUrl, tx);
      expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
        {
          type: 'coderabbit_review_approved',
          repo_full_name: repo,
          pr_number: pr,
          correlation_id: observation.correlationId,
          request_id: observation.requestId,
          version: observation.version,
          payload: { coderabbit_comment_url: commentUrl },
        },
        tx,
      );
      expect(logger.info as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'ReviewDetectorProbe.reviewed', repo, pr, queueId: item.id, eventType: 'coderabbit_review_approved', commentUrl },
        'Review detected',
      );
    });
  });

  describe('commentDeleted', () => {
    it('logs info when source comment was deleted', () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const item = makeItem(repo, pr);
      const probe = createProbe();
      probe.withItem(item);
      probe.commentDeleted();
      expect(logger.info as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'ReviewDetectorProbe.commentDeleted', repo, pr, queueId: item.id },
        'Source comment was deleted before edit detection',
      );
    });
  });

  describe('commentNotEdited', () => {
    it('logs debug when comment was not edited', () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const item = makeItem(repo, pr);
      const probe = createProbe();
      probe.withItem(item);
      probe.commentNotEdited();
      expect(logger.debug as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'ReviewDetectorProbe.commentNotEdited', repo, pr, queueId: item.id },
        'Source comment not edited since last detection',
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
