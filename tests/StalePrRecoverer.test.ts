import { buildPrUrl } from '../src/github/index.js';
import { StalePrRecovererImpl } from '../src/services.js';
import type { OnDetectedCallback } from '../src/types/index.js';

import { createMockOnDetectedCallback, createMockPullRequestRepo } from './helpers/index.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('StalePrRecovererImpl', () => {
  let pullRequests: ReturnType<typeof createMockPullRequestRepo>;
  let onDetected: jest.Mocked<OnDetectedCallback>;
  let logger: ReturnType<typeof createMockLogger>;
  let recoverer: StalePrRecovererImpl;
  let frozenNow: Date;

  beforeEach(() => {
    pullRequests = createMockPullRequestRepo();
    onDetected = createMockOnDetectedCallback();
    logger = createMockLogger();
    recoverer = new StalePrRecovererImpl(pullRequests, onDetected, logger);
    frozenNow = getUniqueDate();
    jest.useFakeTimers();
    jest.setSystemTime(frozenNow);
  });

  describe('recover', () => {
    it('does nothing when there are no stale PRs', async () => {
      pullRequests.findStaleOpenPRs.mockResolvedValue([]);

      await recoverer.recover();

      expect(onDetected).not.toHaveBeenCalled();
    });

    it('enqueues a synthetic comment for each stale PR', async () => {
      const { fullName: repoFullName } = getUniqueGitHubRepoRef();
      const prId = getUniqueInt();
      const prNumber = getUniqueInt();
      const pr = { id: prId, repoFullName: repoFullName, prNumber: prNumber, title: 'Test PR', lastReviewRequestedAt: getUniqueDate() };
      pullRequests.findStaleOpenPRs.mockResolvedValue([pr]);

      await recoverer.recover();

      expect(logger.warn).toHaveBeenCalledWith({ fn: 'StalePrRecoverer.recover', count: 1 }, 'Recovering stale open PRs with no review-limit comment');
      expect(onDetected).toHaveBeenCalledWith(
        {
          url: buildPrUrl(repoFullName, prNumber),
          repoFullName,
          prNumber,
          commentId: -frozenNow.getTime(),
          createdAt: frozenNow.toISOString(),
          updatedAt: frozenNow.toISOString(),
          prTitle: pr.title,
          body: 'rate limited by coderabbit.ai — recovered from deleted comment',
          commentType: 'review_limited',
        },
        prId,
      );
    });

    it('catches error from onDetected and continues processing remaining PRs', async () => {
      const error = new Error('Connection refused');
      const pr1 = {
        id: getUniqueInt(),
        repoFullName: getUniqueGitHubRepoRef().fullName,
        prNumber: getUniqueInt(),
        title: 'PR 1',
        lastReviewRequestedAt: getUniqueDate(),
      };
      const pr2 = {
        id: getUniqueInt(),
        repoFullName: getUniqueGitHubRepoRef().fullName,
        prNumber: getUniqueInt(),
        title: 'PR 2',
        lastReviewRequestedAt: getUniqueDate(),
      };
      pullRequests.findStaleOpenPRs.mockResolvedValue([pr1, pr2]);
      onDetected.mockRejectedValueOnce(error);

      await recoverer.recover();

      expect(logger.warn).toHaveBeenCalledWith({ fn: 'StalePrRecoverer.recover', count: 2 }, 'Recovering stale open PRs with no review-limit comment');
      expect(logger.warn).toHaveBeenCalledWith(
        { fn: 'StalePrRecoverer.recover', repoFullName: pr1.repoFullName, prNumber: pr1.prNumber, prId: pr1.id, error },
        'Failed to recover stale PR; will retry next tick',
      );
      expect(onDetected).toHaveBeenCalledWith(
        {
          url: buildPrUrl(pr2.repoFullName, pr2.prNumber),
          repoFullName: pr2.repoFullName,
          prNumber: pr2.prNumber,
          commentId: -frozenNow.getTime(),
          createdAt: frozenNow.toISOString(),
          updatedAt: frozenNow.toISOString(),
          prTitle: pr2.title,
          body: 'rate limited by coderabbit.ai — recovered from deleted comment',
          commentType: 'review_limited',
        },
        pr2.id,
      );
    });

    it('processes multiple stale PRs', async () => {
      const pr1 = {
        id: getUniqueInt(),
        repoFullName: getUniqueGitHubRepoRef().fullName,
        prNumber: getUniqueInt(),
        title: 'PR 1',
        lastReviewRequestedAt: getUniqueDate(),
      };
      const pr2 = {
        id: getUniqueInt(),
        repoFullName: getUniqueGitHubRepoRef().fullName,
        prNumber: getUniqueInt(),
        title: 'PR 2',
        lastReviewRequestedAt: getUniqueDate(),
      };
      pullRequests.findStaleOpenPRs.mockResolvedValue([pr1, pr2]);

      await recoverer.recover();

      expect(logger.warn).toHaveBeenCalledWith({ fn: 'StalePrRecoverer.recover', count: 2 }, 'Recovering stale open PRs with no review-limit comment');
      expect(onDetected).toHaveBeenCalledWith(
        {
          url: buildPrUrl(pr1.repoFullName, pr1.prNumber),
          repoFullName: pr1.repoFullName,
          prNumber: pr1.prNumber,
          commentId: -frozenNow.getTime(),
          createdAt: frozenNow.toISOString(),
          updatedAt: frozenNow.toISOString(),
          prTitle: pr1.title,
          body: 'rate limited by coderabbit.ai — recovered from deleted comment',
          commentType: 'review_limited',
        },
        pr1.id,
      );
      expect(onDetected).toHaveBeenCalledWith(
        {
          url: buildPrUrl(pr2.repoFullName, pr2.prNumber),
          repoFullName: pr2.repoFullName,
          prNumber: pr2.prNumber,
          commentId: -frozenNow.getTime(),
          createdAt: frozenNow.toISOString(),
          updatedAt: frozenNow.toISOString(),
          prTitle: pr2.title,
          body: 'rate limited by coderabbit.ai — recovered from deleted comment',
          commentType: 'review_limited',
        },
        pr2.id,
      );
    });
  });
});
