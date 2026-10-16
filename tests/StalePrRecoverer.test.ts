import { buildPrUrl } from '../src/github/index.js';
import { IgnoreRules, StalePrRecoverer } from '../src/services.js';
import type { OnDetectedCallback } from '../src/types/index.js';

import { createMockOnDetectedCallback, createMockPullRequestRepo, generateConfigData, generateReviewRef } from './helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('StalePrRecoverer', () => {
  let pullRequests: ReturnType<typeof createMockPullRequestRepo>;
  let onDetected: jest.Mocked<OnDetectedCallback>;
  let logger: ReturnType<typeof createMockLogger>;
  let ignoreRules: IgnoreRules;
  let recoverer: StalePrRecoverer;
  let frozenNow: Date;

  beforeEach(() => {
    pullRequests = createMockPullRequestRepo();
    onDetected = createMockOnDetectedCallback();
    logger = createMockLogger();
    ignoreRules = new IgnoreRules(generateConfigData());
    recoverer = new StalePrRecoverer(pullRequests, onDetected, ignoreRules, logger);
    frozenNow = getUniqueDate();
    jest.useFakeTimers();
    jest.setSystemTime(frozenNow);
  });

  describe('recover', () => {
    it('does nothing when there are no stale PRs', async () => {
      pullRequests.findStaleOpenPRs.mockResolvedValue([]);

      const result = await recoverer.recover();

      expect(result).toStrictEqual([]);
      expect(onDetected).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('enqueues a synthetic comment for each stale PR', async () => {
      const ref = generateReviewRef();
      const prId = getUniqueInt();
      const pr = {
        id: prId,
        authorLogin: getUniqueString(),
        repoFullName: ref.repoFullName,
        prNumber: ref.prNumber,
        title: 'Test PR',
        lastReviewRequestedAt: getUniqueDate(),
      };
      pullRequests.findStaleOpenPRs.mockResolvedValue([pr]);

      const result = await recoverer.recover();

      expect(result).toStrictEqual([pr]);
      expect(logger.warn).toHaveBeenCalledWith({ fn: 'StalePrRecoverer.recover', count: 1 }, 'Recovering stale open PRs with no review-limit comment');
      expect(onDetected).toHaveBeenCalledWith(
        {
          url: buildPrUrl(ref.repoFullName, ref.prNumber),
          repoFullName: ref.repoFullName,
          prNumber: ref.prNumber,
          commentId: -frozenNow.getTime(),
          createdAt: frozenNow.toISOString(),
          updatedAt: frozenNow.toISOString(),
          prTitle: pr.title,
          body: 'rate limited by coderabbit.ai — recovered from deleted comment',
          commentType: 'review_limited',
          detectedVia: 'stale_recovery',
        },
        prId,
      );
    });

    it('drops a stale PR whose author matches an ignore rule', async () => {
      const matchingRef = generateReviewRef();
      const keptRef = generateReviewRef();
      const matchingPr = {
        id: getUniqueInt(),
        authorLogin: 'renovate-bot',
        repoFullName: matchingRef.repoFullName,
        prNumber: matchingRef.prNumber,
        title: 'Bump lodash',
        lastReviewRequestedAt: getUniqueDate(),
      };
      const keptPr = {
        id: getUniqueInt(),
        authorLogin: getUniqueString(),
        repoFullName: keptRef.repoFullName,
        prNumber: keptRef.prNumber,
        title: 'Fix the build',
        lastReviewRequestedAt: getUniqueDate(),
      };
      ignoreRules = new IgnoreRules(generateConfigData({ IGNORE_AUTHORS: ['renovate'] }));
      recoverer = new StalePrRecoverer(pullRequests, onDetected, ignoreRules, logger);
      pullRequests.findStaleOpenPRs.mockResolvedValue([matchingPr, keptPr]);

      const result = await recoverer.recover();

      expect(result).toStrictEqual([keptPr]);
      expect(logger.warn).toHaveBeenCalledWith({ fn: 'StalePrRecoverer.recover', count: 1 }, 'Recovering stale open PRs with no review-limit comment');
      expect(onDetected).toHaveBeenCalledTimes(1);
      expect(onDetected).toHaveBeenCalledWith(expect.anything(), keptPr.id);
    });

    it('drops a stale PR whose title matches an ignore rule', async () => {
      const matchingRef = generateReviewRef();
      const matchingPr = {
        id: getUniqueInt(),
        authorLogin: getUniqueString(),
        repoFullName: matchingRef.repoFullName,
        prNumber: matchingRef.prNumber,
        title: 'chore(deps): bump lodash',
        lastReviewRequestedAt: getUniqueDate(),
      };
      ignoreRules = new IgnoreRules(generateConfigData({ IGNORE_TITLES: ['^chore\\('] }));
      recoverer = new StalePrRecoverer(pullRequests, onDetected, ignoreRules, logger);
      pullRequests.findStaleOpenPRs.mockResolvedValue([matchingPr]);

      const result = await recoverer.recover();

      expect(result).toStrictEqual([]);
      expect(onDetected).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('catches error from onDetected and continues processing remaining PRs', async () => {
      const error = new Error('Connection refused');
      const pr1Ref = generateReviewRef();
      const pr1 = {
        id: getUniqueInt(),
        authorLogin: getUniqueString(),
        repoFullName: pr1Ref.repoFullName,
        prNumber: pr1Ref.prNumber,
        title: 'PR 1',
        lastReviewRequestedAt: getUniqueDate(),
      };
      const pr2Ref = generateReviewRef();
      const pr2 = {
        id: getUniqueInt(),
        authorLogin: getUniqueString(),
        repoFullName: pr2Ref.repoFullName,
        prNumber: pr2Ref.prNumber,
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
          detectedVia: 'stale_recovery',
        },
        pr2.id,
      );
    });

    it('processes multiple stale PRs', async () => {
      const pr1Ref = generateReviewRef();
      const pr1 = {
        id: getUniqueInt(),
        authorLogin: getUniqueString(),
        repoFullName: pr1Ref.repoFullName,
        prNumber: pr1Ref.prNumber,
        title: 'PR 1',
        lastReviewRequestedAt: getUniqueDate(),
      };
      const pr2Ref = generateReviewRef();
      const pr2 = {
        id: getUniqueInt(),
        authorLogin: getUniqueString(),
        repoFullName: pr2Ref.repoFullName,
        prNumber: pr2Ref.prNumber,
        title: 'PR 2',
        lastReviewRequestedAt: getUniqueDate(),
      };
      pullRequests.findStaleOpenPRs.mockResolvedValue([pr1, pr2]);

      const result = await recoverer.recover();

      expect(result).toStrictEqual([pr1, pr2]);
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
          detectedVia: 'stale_recovery',
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
          detectedVia: 'stale_recovery',
        },
        pr2.id,
      );
    });
  });
});
