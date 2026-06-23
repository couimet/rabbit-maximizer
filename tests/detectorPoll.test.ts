import { PollDetector } from '../src/detectorPoll.js';
import type { CoderabbitGitHubClient } from '../src/github/coderabbitGitHubClient.js';
import type { RateLimitComment } from '../src/types/RateLimitComment.js';

import { createMockLogger, drainMicrotasks } from './helpers/index.js';

import { getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const DEFAULT_FALLBACK_WAIT_SECONDS = 3600;
const POLL_INTERVAL_SEC = 90;
const POLL_INTERVAL_MS = POLL_INTERVAL_SEC * 1000;
const EXPECTED_REPO_COUNT = 1;
const MS_PER_SECOND = 1000;
const TICK_DEPTH = 20;

interface MockDetectorDeps {
  github: CoderabbitGitHubClient;
  onDetected: jest.Mock<any>;
  logger: Logger;
}

const makeComment = (overrides: { commentId?: number; repoFullName?: string; prNumber?: number; createdAt?: string }): RateLimitComment => ({
  url: getUniqueString({ prefix: 'https://gh/c/' }),
  repo_full_name: overrides.repoFullName ?? `${getUniqueString({ prefix: 'org' })}/${getUniqueString({ prefix: 'repo' })}`,
  pr_number: overrides.prNumber ?? getUniqueInt(),
  comment_id: overrides.commentId ?? getUniqueInt(),
  created_at: overrides.createdAt ?? new Date().toISOString(),
});

const setup = (): MockDetectorDeps => {
  const github = {
    searchRateLimitComments: jest.fn<any>(),
    fetchComment: jest.fn<any>(),
    postRetrigger: jest.fn<any>(),
  } as unknown as CoderabbitGitHubClient;

  const onDetected = jest.fn<any>().mockResolvedValue(undefined);
  const logger = createMockLogger();

  return { github, onDetected, logger };
};

describe('PollDetector', () => {
  let deps: MockDetectorDeps;

  beforeEach(() => {
    deps = setup();
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  const createDetector = () => new PollDetector(deps.github, deps.onDetected, deps.logger);

  describe('start', () => {
    it('fires the first tick immediately and starts an interval', async () => {
      (deps.github.searchRateLimitComments as jest.Mock<any>).mockResolvedValue([]);

      const detector = createDetector();
      const { stop } = detector.start();

      expect(deps.github.searchRateLimitComments).toHaveBeenCalledTimes(1);
      expect(deps.logger.info).toHaveBeenCalledWith(
        { fn: 'PollDetector.start', pollIntervalSec: POLL_INTERVAL_SEC, repoCount: EXPECTED_REPO_COUNT },
        'Starting poll detector',
      );

      await stop();
    });

    it('stop clears the interval', async () => {
      (deps.github.searchRateLimitComments as jest.Mock<any>).mockResolvedValue([]);

      const detector = createDetector();
      const { stop } = detector.start();

      await stop();
      jest.advanceTimersByTime(POLL_INTERVAL_MS * 2);

      expect(deps.github.searchRateLimitComments).toHaveBeenCalledTimes(1);
      expect(deps.logger.info).toHaveBeenCalledWith({ fn: 'PollDetector.stop' }, 'Poll detector stopped');
    });
  });

  describe('detection', () => {
    it('fetches body, verifies markers, and fires onDetected callback with jittered wait', async () => {
      const comment = makeComment({});
      const bodyText = 'some text rate limited by coderabbit.ai more text Please wait 5 minutes and 30 seconds before requesting another review.';
      (deps.github.searchRateLimitComments as jest.Mock<any>).mockResolvedValue([comment]);
      (deps.github.fetchComment as jest.Mock<any>).mockResolvedValue(bodyText);

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
      (deps.github.searchRateLimitComments as jest.Mock<any>).mockResolvedValue([comment]);
      (deps.github.fetchComment as jest.Mock<any>).mockResolvedValue(bodyText);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.onDetected).toHaveBeenCalledWith(comment, DEFAULT_FALLBACK_WAIT_SECONDS);
    });
  });

  describe('dedup', () => {
    it('skips comments already in seenCommentIds on subsequent ticks', async () => {
      const comment = makeComment({});
      const bodyText = 'rate limited by coderabbit.ai Please wait 1 minute before requesting another review.';
      (deps.github.searchRateLimitComments as jest.Mock<any>).mockResolvedValue([comment]);
      (deps.github.fetchComment as jest.Mock<any>).mockResolvedValue(bodyText);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.onDetected).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(POLL_INTERVAL_MS);
      await drainMicrotasks(TICK_DEPTH);

      expect(deps.onDetected).toHaveBeenCalledTimes(1);
    });
  });

  describe('self-marker exclusion', () => {
    it('skips comments whose full body contains the own-retrigger marker', async () => {
      const comment = makeComment({});
      const bodyText = 'rate limited by coderabbit.ai <!-- rabbit-maximizer already processed -->';
      (deps.github.searchRateLimitComments as jest.Mock<any>).mockResolvedValue([comment]);
      (deps.github.fetchComment as jest.Mock<any>).mockResolvedValue(bodyText);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.onDetected).not.toHaveBeenCalled();
    });

    it('skips comments that lack the rate-limit marker', async () => {
      const comment = makeComment({});
      const bodyText = 'some unrelated comment body';
      (deps.github.searchRateLimitComments as jest.Mock<any>).mockResolvedValue([comment]);
      (deps.github.fetchComment as jest.Mock<any>).mockResolvedValue(bodyText);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.onDetected).not.toHaveBeenCalled();
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
      (deps.github.searchRateLimitComments as jest.Mock<any>).mockRejectedValue(rateLimitError);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.logger.warn).toHaveBeenCalledWith(
        { fn: 'PollDetector.tick', status: 403, retryAfterSec: expectedRetryAfterSec },
        'GitHub API rate limit exhausted; backing off until reset',
      );
      expect(deps.github.searchRateLimitComments).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(POLL_INTERVAL_MS);
      await Promise.resolve();
      expect(deps.github.searchRateLimitComments).toHaveBeenCalledTimes(1);
    });

    it('logs warning when rate limit response has non-numeric x-ratelimit-reset header', async () => {
      const rateLimitError = {
        status: 429,
        response: { headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': 'not-a-number' } },
      };
      (deps.github.searchRateLimitComments as jest.Mock<any>).mockRejectedValue(rateLimitError);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.logger.warn).toHaveBeenCalledWith(
        { fn: 'PollDetector.tick', status: 429 },
        'Rate limit response missing valid x-ratelimit-reset header; skipping backoff',
      );
      expect(deps.github.searchRateLimitComments).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(POLL_INTERVAL_MS);
      await Promise.resolve();
      expect(deps.github.searchRateLimitComments).toHaveBeenCalledTimes(2);
    });

    it('logs generic warning for non-rate-limit errors and continues', async () => {
      const networkError = new Error('Network error');
      (deps.github.searchRateLimitComments as jest.Mock<any>).mockRejectedValue(networkError);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.logger.warn).toHaveBeenCalledWith({ fn: 'PollDetector.tick', error: networkError }, 'Poll tick failed; will retry on next interval');
    });

    it('logs generic warning with String(err) for non-Error rejections', async () => {
      (deps.github.searchRateLimitComments as jest.Mock<any>).mockRejectedValue('plain string error');

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.logger.warn).toHaveBeenCalledWith({ fn: 'PollDetector.tick', error: 'plain string error' }, 'Poll tick failed; will retry on next interval');
    });
  });

  describe('concurrency', () => {
    it('skips tick when another tick is already in-flight', async () => {
      let resolveSearch: (value: unknown) => void;
      const searchPromise = new Promise((resolve) => {
        resolveSearch = resolve;
      });
      (deps.github.searchRateLimitComments as jest.Mock<any>).mockReturnValue(searchPromise);

      const detector = createDetector();
      detector.start();

      await Promise.resolve();

      detector['tick']();

      await Promise.resolve();

      expect(deps.github.searchRateLimitComments).toHaveBeenCalledTimes(1);

      resolveSearch!([]);
      await Promise.resolve();
    });
  });
});
