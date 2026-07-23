import { StalePrRecovererImpl } from '../src/services.js';
import type { DetectedComment, OnDetectedCallback } from '../src/types/index.js';

import { createMockOnDetectedCallback, createMockPullRequestRepo } from './helpers/index.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const FALLBACK_WAIT_SECONDS = 3600;

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
      const PR_ID = getUniqueInt();
      const PR_NUMBER = getUniqueInt();
      const pr = { id: PR_ID, repoFullName: repoFullName, prNumber: PR_NUMBER, title: 'Test PR', lastReviewRequestedAt: getUniqueDate() };
      pullRequests.findStaleOpenPRs.mockResolvedValue([pr]);

      await recoverer.recover();

      expect(logger.warn).toHaveBeenCalledWith({ fn: 'StalePrRecoverer.recover', count: 1 }, 'Recovering stale open PRs with no review-limit comment');
      expect(onDetected).toHaveBeenCalledWith(
        expect.objectContaining({
          repoFullName,
          prNumber: PR_NUMBER,
          commentId: -frozenNow.getTime(),
          body: 'rate limited by coderabbit.ai — recovered from deleted comment',
        }) as DetectedComment,
        FALLBACK_WAIT_SECONDS,
        PR_ID,
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
        expect.objectContaining({ repoFullName: pr1.repoFullName, prNumber: pr1.prNumber }) as DetectedComment,
        FALLBACK_WAIT_SECONDS,
        pr1.id,
      );
      expect(onDetected).toHaveBeenCalledWith(
        expect.objectContaining({ repoFullName: pr2.repoFullName, prNumber: pr2.prNumber }) as DetectedComment,
        FALLBACK_WAIT_SECONDS,
        pr2.id,
      );
    });
  });
});
