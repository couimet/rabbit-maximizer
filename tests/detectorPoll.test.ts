import { PollDetector } from '../src/detectorPoll.js';
import type { CoderabbitGitHubClient } from '../src/github/coderabbitGitHubClient.js';
import type { DetectedComment } from '../src/types/DetectedComment.js';
import type { OnDetectedCallback } from '../src/types/OnDetectedCallback.js';

import { createMockCoderabbitGitHubClient, createMockOnDetectedCallback, createMockSystemStateRepository, drainMicrotasks } from './helpers/index.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const DEFAULT_FALLBACK_WAIT_SECONDS = 3600;
const POLL_INTERVAL_SEC = 90;
const POLL_INTERVAL_MS = POLL_INTERVAL_SEC * 1000;
const EXPECTED_REPO_COUNT = 1;
const MS_PER_SECOND = 1000;
const MS_PER_HOUR = 60 * 60 * MS_PER_SECOND;
const TICK_DEPTH = 20;

interface MockDetectorDeps {
  github: jest.Mocked<CoderabbitGitHubClient>;
  onDetected: jest.Mocked<OnDetectedCallback>;
  systemStateRepo: {
    getState: jest.Mock<any>;
    setState: jest.Mock<any>;
    isSchedulerPaused: jest.Mock<any>;
    pauseScheduler: jest.Mock<any>;
    resumeScheduler: jest.Mock<any>;
  };
  logger: Logger;
}

const makeComment = (overrides: { commentId?: number; repoFullName?: string; prNumber?: number; createdAt?: string; updatedAt?: string }): DetectedComment => ({
  url: getUniqueString({ prefix: 'https://gh/c/' }),
  repo_full_name: overrides.repoFullName ?? getUniqueGitHubRepoRef().fullName,
  pr_number: overrides.prNumber ?? getUniqueInt(),
  pr_title: getUniqueString({ prefix: 'pr-title-' }),
  comment_id: overrides.commentId ?? getUniqueInt(),
  created_at: overrides.createdAt ?? getUniqueDate().toISOString(),
  updated_at: overrides.updatedAt ?? getUniqueDate().toISOString(),
});

const setup = (): MockDetectorDeps => {
  const github = createMockCoderabbitGitHubClient();

  const onDetected = createMockOnDetectedCallback();
  const systemStateRepo = createMockSystemStateRepository() as unknown as MockDetectorDeps['systemStateRepo'];
  const logger = createMockLogger();

  return { github, onDetected, systemStateRepo, logger };
};

describe('PollDetector', () => {
  let deps: MockDetectorDeps;

  beforeEach(() => {
    deps = setup();
    jest.useFakeTimers();
  });

  const createDetector = () => new PollDetector(deps.github, deps.onDetected, deps.systemStateRepo, deps.logger);

  describe('start', () => {
    it('fires the first tick immediately and starts an interval', async () => {
      deps.github.searchReviewLimitComments.mockResolvedValue([]);

      const detector = createDetector();
      const { stop } = detector.start();

      expect(deps.github.searchReviewLimitComments).toHaveBeenCalledTimes(1);
      expect(deps.logger.info).toHaveBeenCalledWith(
        { fn: 'PollDetector.start', pollIntervalSec: POLL_INTERVAL_SEC, repoCount: EXPECTED_REPO_COUNT },
        'Starting poll detector',
      );

      await stop();
    });

    it('stop clears the interval', async () => {
      deps.github.searchReviewLimitComments.mockResolvedValue([]);

      const detector = createDetector();
      const { stop } = detector.start();

      await stop();
      jest.advanceTimersByTime(POLL_INTERVAL_MS * 2);

      expect(deps.github.searchReviewLimitComments).toHaveBeenCalledTimes(1);
      expect(deps.logger.info).toHaveBeenCalledWith({ fn: 'PollDetector.stop' }, 'Poll detector stopped');
    });
  });

  describe('detection', () => {
    it('fetches body, verifies markers, and fires onDetected callback with wait seconds', async () => {
      const comment = makeComment({});
      const bodyText = 'some text rate limited by coderabbit.ai more text Please wait 5 minutes and 30 seconds before requesting another review.';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue(bodyText);

      const expectedWaitSeconds = 5 * 60 + 30;

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      const [owner, repo] = comment.repo_full_name.split('/');
      expect(deps.github.fetchComment).toHaveBeenCalledWith(owner, repo, comment.comment_id);
      expect(deps.onDetected).toHaveBeenCalledWith(comment, expectedWaitSeconds);
    });

    it('falls back to DEFAULT_FALLBACK_WAIT_SECONDS when parseWaitSeconds returns undefined', async () => {
      const comment = makeComment({});
      const bodyText = 'rate limited by coderabbit.ai but no wait time pattern';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue(bodyText);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.onDetected).toHaveBeenCalledWith(comment, DEFAULT_FALLBACK_WAIT_SECONDS);
    });
  });

  describe('self-marker exclusion', () => {
    it('skips comments whose full body contains the own-retrigger marker', async () => {
      const comment = makeComment({});
      const bodyText = 'rate limited by coderabbit.ai <!-- rabbit-maximizer already processed -->';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue(bodyText);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.onDetected).not.toHaveBeenCalled();
    });

    it('skips comments that lack the rate-limit marker', async () => {
      const comment = makeComment({});
      const bodyText = 'some unrelated comment body';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue(bodyText);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.onDetected).not.toHaveBeenCalled();
    });
  });

  describe('concurrency', () => {
    it('skips tick when another tick is already in-flight', async () => {
      let resolveSearch: (value: DetectedComment[]) => void;
      const searchPromise = new Promise<DetectedComment[]>((resolve) => {
        resolveSearch = resolve;
      });
      deps.github.searchReviewLimitComments.mockReturnValue(searchPromise);

      const detector = createDetector();
      const { stop } = detector.start();

      await Promise.resolve();

      detector['tick']();

      await Promise.resolve();

      expect(deps.github.searchReviewLimitComments).toHaveBeenCalledTimes(1);

      resolveSearch!([]);
      await stop();
    });
  });

  describe('error handling', () => {
    it('logs rate-limit warning when API returns 403 with exhausted quota and sets backoff', async () => {
      const resetEpoch = Math.ceil(Date.now() / MS_PER_SECOND) + 120;
      const retryAfterMs = Math.max(0, resetEpoch * MS_PER_SECOND - Date.now());
      const expectedRetryAfterSec = Math.ceil(retryAfterMs / MS_PER_SECOND);
      const rateLimitError = {
        status: 403,
        response: { headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(resetEpoch) } },
      };
      deps.github.searchReviewLimitComments.mockRejectedValue(rateLimitError);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.logger.warn).toHaveBeenCalledWith(
        { fn: 'PollDetector.tick', status: 403, retryAfterSec: expectedRetryAfterSec },
        'GitHub API rate limit exhausted; backing off until reset',
      );
      expect(deps.github.searchReviewLimitComments).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(POLL_INTERVAL_MS);
      await Promise.resolve();
      expect(deps.github.searchReviewLimitComments).toHaveBeenCalledTimes(1);
    });

    it('logs warning when rate limit response has non-numeric x-ratelimit-reset header', async () => {
      const rateLimitError = {
        status: 429,
        response: { headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': 'not-a-number' } },
      };
      deps.github.searchReviewLimitComments.mockRejectedValue(rateLimitError);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.logger.warn).toHaveBeenCalledWith(
        { fn: 'PollDetector.tick', status: 429 },
        'Rate limit response missing valid x-ratelimit-reset header; skipping backoff',
      );
      expect(deps.github.searchReviewLimitComments).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(POLL_INTERVAL_MS);
      await Promise.resolve();
      expect(deps.github.searchReviewLimitComments).toHaveBeenCalledTimes(2);
    });

    it('logs generic warning for non-rate-limit errors and continues', async () => {
      const networkError = new Error('Network error');
      deps.github.searchReviewLimitComments.mockRejectedValue(networkError);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.logger.warn).toHaveBeenCalledWith({ fn: 'PollDetector.tick', error: networkError }, 'Poll tick failed; will retry on next interval');
    });

    it('logs warning when rate limit response is missing a valid x-ratelimit-reset header', async () => {
      const badHeaderError = {
        status: 403,
        response: { headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': 'not-a-number' } },
      };
      deps.github.searchReviewLimitComments.mockRejectedValue(badHeaderError);

      const detector = createDetector();
      detector.start();

      for (let i = 0; i < TICK_DEPTH; i++) {
        await Promise.resolve();
      }

      expect(deps.logger.warn).toHaveBeenCalledWith(
        { fn: 'PollDetector.tick', status: 403 },
        'Rate limit response missing valid x-ratelimit-reset header; skipping backoff',
      );
    });
  });

  describe('system state tracking', () => {
    it('upserts next_review_available_at when no existing state', async () => {
      const updatedAt = getUniqueDate().toISOString();
      const comment = makeComment({ updatedAt });
      const bodyText = 'rate limited by coderabbit.ai Please wait 5 minutes and 30 seconds before requesting another review.';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue(bodyText);

      const expectedWaitSeconds = 5 * 60 + 30;
      const expectedDate = new Date(new Date(updatedAt).getTime() + expectedWaitSeconds * MS_PER_SECOND);

      deps.systemStateRepo.getState.mockResolvedValue(undefined);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.systemStateRepo.setState).toHaveBeenCalledWith('next_review_available_at', expectedDate);
      expect(deps.onDetected).toHaveBeenCalledWith(comment, expectedWaitSeconds);
    });

    it('updates when new comment has an earlier available time than existing state', async () => {
      const now = Date.now();
      const comment = makeComment({ updatedAt: new Date(now).toISOString() });
      const bodyText = 'rate limited by coderabbit.ai Please wait 5 minutes and 30 seconds before requesting another review.';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue(bodyText);

      const expectedWaitSeconds = 5 * 60 + 30;
      const expectedDate = new Date(now + expectedWaitSeconds * 1000);
      const laterDate = new Date(expectedDate.getTime() + 3600_000);

      deps.systemStateRepo.getState.mockResolvedValue(laterDate);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.systemStateRepo.setState).toHaveBeenCalledWith('next_review_available_at', expectedDate);
    });

    it('skips update when new comment has a later available time than existing state', async () => {
      const now = Date.now();
      const comment = makeComment({ updatedAt: new Date(now).toISOString() });
      const bodyText = 'rate limited by coderabbit.ai Please wait 5 minutes and 30 seconds before requesting another review.';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue(bodyText);

      const expectedWaitSeconds = 5 * 60 + 30;
      const earlierDate = new Date(now + 60_000);

      deps.systemStateRepo.getState.mockResolvedValue(earlierDate);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.systemStateRepo.setState).not.toHaveBeenCalled();
      expect(deps.onDetected).toHaveBeenCalledWith(comment, expectedWaitSeconds);
    });

    it('uses correct StateKey and Date values when upserting state', async () => {
      const updatedAt = getUniqueDate().toISOString();
      const comment = makeComment({ updatedAt });
      const bodyText = 'rate limited by coderabbit.ai Please wait 2 minutes before requesting another review.';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue(bodyText);

      const expectedWaitSeconds = 120;
      const expectedDate = new Date(new Date(updatedAt).getTime() + expectedWaitSeconds * MS_PER_SECOND);

      deps.systemStateRepo.getState.mockResolvedValue(undefined);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.systemStateRepo.setState).toHaveBeenCalledTimes(1);
      expect(deps.systemStateRepo.setState).toHaveBeenCalledWith('next_review_available_at', expectedDate);
      expect(deps.systemStateRepo.getState).toHaveBeenCalledWith('next_review_available_at');
    });

    it('picks the earliest candidate across multiple comments', async () => {
      const earlyDate = getUniqueDate();
      const laterDate = new Date(earlyDate.getTime() + MS_PER_HOUR);
      const earlyComment = makeComment({ updatedAt: earlyDate.toISOString() });
      const laterComment = makeComment({ updatedAt: laterDate.toISOString() });
      const bodyText = 'rate limited by coderabbit.ai Please wait 10 minutes before requesting another review.';
      deps.github.searchReviewLimitComments.mockResolvedValue([earlyComment, laterComment]);
      deps.github.fetchComment.mockResolvedValue(bodyText);

      const expectedWaitSeconds = 600;
      const expectedDate = new Date(new Date(earlyComment.updated_at).getTime() + expectedWaitSeconds * 1000);

      deps.systemStateRepo.getState.mockResolvedValue(undefined);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.systemStateRepo.setState).toHaveBeenCalledTimes(1);
      expect(deps.systemStateRepo.setState).toHaveBeenCalledWith('next_review_available_at', expectedDate);
      expect(deps.onDetected).toHaveBeenCalledTimes(2);
    });
  });
});
