import { StateKey } from '../src/db/index.js';
import type { CoderabbitGitHubClient } from '../src/github/index.js';
import { PollDetector } from '../src/services.js';
import type { DetectedComment, OnDetectedCallback } from '../src/types/index.js';

import {
  createMockCoderabbitGitHubClient,
  createMockOnDetectedCallback,
  createMockPrScanner,
  createMockPullRequestRepo,
  createMockStalePrRecoverer,
  createMockSystemStateRepository,
  drainMicrotasks,
  generateDetectedCommentHydrationData,
} from './helpers/index.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const POLL_INTERVAL_SEC = 90;
const POLL_INTERVAL_MS = POLL_INTERVAL_SEC * 1000;
const EXPECTED_REPO_COUNT = 1;
const MS_PER_SECOND = 1000;
const MS_PER_HOUR = 60 * 60 * MS_PER_SECOND;
const TICK_DEPTH = 20;
interface MockDetectorDeps {
  github: jest.Mocked<CoderabbitGitHubClient>;
  onDetected: jest.Mocked<OnDetectedCallback>;
  prScanner: ReturnType<typeof createMockPrScanner>;
  pullRequests: ReturnType<typeof createMockPullRequestRepo>;
  stalePrRecoverer: ReturnType<typeof createMockStalePrRecoverer>;
  systemStateRepo: ReturnType<typeof createMockSystemStateRepository>;
  logger: Logger;
}

const setup = (): MockDetectorDeps => {
  const github = createMockCoderabbitGitHubClient();

  const onDetected = createMockOnDetectedCallback();
  const prScanner = createMockPrScanner();
  const pullRequests = createMockPullRequestRepo();
  const stalePrRecoverer = createMockStalePrRecoverer();
  const systemStateRepo = createMockSystemStateRepository();
  const logger = createMockLogger();

  return { github, onDetected, prScanner, pullRequests, stalePrRecoverer, systemStateRepo, logger };
};

describe('PollDetector', () => {
  let deps: MockDetectorDeps;
  let frozenNow: Date;
  let pullRequestId: number;

  beforeEach(() => {
    deps = setup();
    frozenNow = getUniqueDate();
    pullRequestId = getUniqueInt();
    jest.useFakeTimers();
    jest.setSystemTime(frozenNow);
  });

  const createDetector = () =>
    new PollDetector(deps.github, deps.prScanner, deps.stalePrRecoverer, deps.onDetected, deps.pullRequests, deps.systemStateRepo, deps.logger);

  describe('start', () => {
    it('fires the first tick immediately and starts an interval', async () => {
      deps.github.searchReviewLimitComments.mockResolvedValue([]);

      const detector = createDetector();
      const { stop } = detector.start();

      await drainMicrotasks(TICK_DEPTH);

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
    it('fetches body, verifies markers, and fires onDetected callback', async () => {
      const comment = generateDetectedCommentHydrationData();
      const bodyText = 'some text rate limited by coderabbit.ai more text Please wait 5 minutes and 30 seconds before requesting another review.';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, updatedAt: comment.updatedAt });
      deps.pullRequests.findByRepoAndPr.mockResolvedValue({ id: pullRequestId });

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      const [owner, repo] = comment.repoFullName.split('/');
      expect(deps.github.fetchComment).toHaveBeenCalledWith(owner, repo, comment.commentId);
      expect(deps.onDetected).toHaveBeenCalledWith({ ...comment, body: bodyText }, pullRequestId);
    });

    it('detects comment even when parseWaitSeconds returns undefined', async () => {
      const comment = generateDetectedCommentHydrationData();
      const bodyText = 'rate limited by coderabbit.ai but no wait time pattern';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, updatedAt: comment.updatedAt });
      deps.pullRequests.findByRepoAndPr.mockResolvedValue({ id: pullRequestId });

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.onDetected).toHaveBeenCalledWith({ ...comment, body: bodyText }, pullRequestId);
    });

    it('scans for PRs at the top of executeTick', async () => {
      deps.github.searchReviewLimitComments.mockResolvedValue([]);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.prScanner.scan).toHaveBeenCalled();
      expect(deps.github.searchReviewLimitComments).toHaveBeenCalled();
      expect(deps.prScanner.scan.mock.invocationCallOrder[0]).toBeLessThan(deps.github.searchReviewLimitComments.mock.invocationCallOrder[0]);
    });

    it('calls stalePrRecoverer.recover() after scan', async () => {
      deps.github.searchReviewLimitComments.mockResolvedValue([]);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.prScanner.scan.mock.invocationCallOrder[0]).toBeLessThan(deps.stalePrRecoverer.recover.mock.invocationCallOrder[0]);
    });

    it('skips comment when PR is not registered', async () => {
      const comment = generateDetectedCommentHydrationData();
      const bodyText = 'rate limited by coderabbit.ai some text';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, updatedAt: comment.updatedAt });

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.onDetected).not.toHaveBeenCalled();
      expect(deps.logger.warn).toHaveBeenCalledWith(
        { fn: 'PollDetector.tick', repo: comment.repoFullName, pr: comment.prNumber },
        'PR not registered; skipping comment',
      );
    });

    it('passes pullRequestId to onDetected', async () => {
      const comment = generateDetectedCommentHydrationData();
      const bodyText = 'rate limited by coderabbit.ai Please wait 5 minutes and 30 seconds before requesting another review.';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, updatedAt: comment.updatedAt });
      deps.pullRequests.findByRepoAndPr.mockResolvedValue({ id: pullRequestId });

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.onDetected).toHaveBeenCalledWith({ ...comment, body: bodyText }, pullRequestId);
    });
  });

  describe('self-marker exclusion', () => {
    it('skips comments whose full body contains the own-retrigger marker', async () => {
      const comment = generateDetectedCommentHydrationData();
      const bodyText = 'rate limited by coderabbit.ai <!-- rabbit-maximizer already processed -->';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, updatedAt: comment.updatedAt });

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      const [owner, repo] = comment.repoFullName.split('/');
      expect(deps.onDetected).not.toHaveBeenCalled();
      expect(deps.logger.debug).toHaveBeenCalledWith(
        { fn: 'PollDetector.tick', owner, repo, commentId: comment.commentId },
        'Skipping comment with own retrigger marker',
      );
    });

    it('skips comments that lack the rate-limit marker', async () => {
      const comment = generateDetectedCommentHydrationData();
      const bodyText = 'some unrelated comment body';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, updatedAt: comment.updatedAt });

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      const [owner, repo] = comment.repoFullName.split('/');
      expect(deps.onDetected).not.toHaveBeenCalled();
      expect(deps.logger.debug).toHaveBeenCalledWith(
        { fn: 'PollDetector.tick', owner, repo, commentId: comment.commentId },
        'Skipping comment without rate-limit marker',
      );
    });
  });

  describe('acknowledgement check', () => {
    it('checks for pending acknowledgements and records them when found', async () => {
      const ackId = getUniqueInt();
      const ackRepo = getUniqueGitHubRepoRef().fullName;
      const ackPr = getUniqueInt();
      const ackCommentId = getUniqueInt();
      const ackCommentUrl = getUniqueString({ prefix: 'https://gh/c/' });
      const [ackOwner, ackRepoName] = ackRepo.split('/');
      const pendingAck = { id: ackId, repo_full_name: ackRepo, pr_number: ackPr, last_review_requested_at: getUniqueDate() };
      const ackResult = { commentId: ackCommentId, commentUrl: ackCommentUrl };
      deps.github.searchReviewLimitComments.mockResolvedValue([]);
      deps.pullRequests.findPendingAcknowledgement.mockResolvedValue(pendingAck);
      deps.github.findAcknowledgement.mockResolvedValue(ackResult);
      const detector = createDetector();
      detector.start();
      await drainMicrotasks(TICK_DEPTH);
      expect(deps.github.findAcknowledgement).toHaveBeenCalledWith(ackOwner, ackRepoName, ackPr, pendingAck.last_review_requested_at);
      expect(deps.pullRequests.recordAcknowledgement).toHaveBeenCalledWith(ackId);
    });

    it('logs a warning and continues when acknowledgement check fails', async () => {
      const ackError = new Error('DB connection lost');
      deps.github.searchReviewLimitComments.mockResolvedValue([]);
      deps.pullRequests.findPendingAcknowledgement.mockRejectedValue(ackError);
      const detector = createDetector();
      detector.start();
      await drainMicrotasks(TICK_DEPTH);
      expect(deps.logger.warn).toHaveBeenCalledWith({ fn: 'PollDetector.tick', error: ackError }, 'Acknowledgement check failed; continuing');
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
      const resetEpoch = Math.ceil(frozenNow.getTime() / MS_PER_SECOND) + 120;
      const retryAfterMs = Math.max(0, resetEpoch * MS_PER_SECOND - frozenNow.getTime());
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

    it('falls through to generic error log when rate limit response has non-numeric x-ratelimit-reset header', async () => {
      const rateLimitError = {
        status: 429,
        response: { headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': 'not-a-number' } },
      };
      deps.github.searchReviewLimitComments.mockRejectedValue(rateLimitError);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.logger.warn).toHaveBeenCalledWith({ fn: 'PollDetector.tick', error: rateLimitError }, 'Poll tick failed; will retry on next interval');
      expect(deps.github.searchReviewLimitComments).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(POLL_INTERVAL_MS);
      await drainMicrotasks(TICK_DEPTH);
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

    it('falls through to generic error log when rate limit response is missing a valid x-ratelimit-reset header', async () => {
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

      expect(deps.logger.warn).toHaveBeenCalledWith({ fn: 'PollDetector.tick', error: badHeaderError }, 'Poll tick failed; will retry on next interval');
    });
  });

  describe('system state tracking', () => {
    it('upserts next_review_available_at when no existing state', async () => {
      const updatedAt = getUniqueDate().toISOString();
      const comment = generateDetectedCommentHydrationData({ updatedAt });
      const bodyText = 'rate limited by coderabbit.ai Please wait 5 minutes and 30 seconds before requesting another review.';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, updatedAt: comment.updatedAt });
      deps.pullRequests.findByRepoAndPr.mockResolvedValue({ id: pullRequestId });

      const expectedWaitSeconds = 5 * 60 + 30;
      const expectedDate = new Date(new Date(updatedAt).getTime() + expectedWaitSeconds * MS_PER_SECOND);

      deps.systemStateRepo.getState.mockResolvedValue(undefined);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.systemStateRepo.setState).toHaveBeenCalledWith('next_review_available_at' as StateKey, expectedDate);
      expect(deps.onDetected).toHaveBeenCalledWith({ ...comment, body: bodyText }, pullRequestId);
    });

    it('updates when new comment has an earlier available time than existing state', async () => {
      const now = frozenNow.getTime();
      const comment = generateDetectedCommentHydrationData({ updatedAt: new Date(now).toISOString() });
      const bodyText = 'rate limited by coderabbit.ai Please wait 5 minutes and 30 seconds before requesting another review.';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, updatedAt: comment.updatedAt });
      deps.pullRequests.findByRepoAndPr.mockResolvedValue({ id: pullRequestId });

      const expectedWaitSeconds = 5 * 60 + 30;
      const expectedDate = new Date(now + expectedWaitSeconds * 1000);
      const laterDate = new Date(expectedDate.getTime() + 3600_000);

      deps.systemStateRepo.getState.mockResolvedValue(laterDate);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.systemStateRepo.setState).toHaveBeenCalledWith('next_review_available_at' as StateKey, expectedDate);
    });

    it('skips update when new comment has a later available time than existing state', async () => {
      const now = frozenNow.getTime();
      const comment = generateDetectedCommentHydrationData({ updatedAt: new Date(now).toISOString() });
      const bodyText = 'rate limited by coderabbit.ai Please wait 5 minutes and 30 seconds before requesting another review.';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, updatedAt: comment.updatedAt });
      deps.pullRequests.findByRepoAndPr.mockResolvedValue({ id: pullRequestId });

      const earlierDate = new Date(now + 60_000);

      deps.systemStateRepo.getState.mockResolvedValue(earlierDate);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.systemStateRepo.setState).not.toHaveBeenCalled();
      expect(deps.onDetected).toHaveBeenCalledWith({ ...comment, body: bodyText }, pullRequestId);
    });

    it('uses correct StateKey and Date values when upserting state', async () => {
      const updatedAt = getUniqueDate().toISOString();
      const comment = generateDetectedCommentHydrationData({ updatedAt });
      const bodyText = 'rate limited by coderabbit.ai Please wait 2 minutes before requesting another review.';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, updatedAt: comment.updatedAt });
      deps.pullRequests.findByRepoAndPr.mockResolvedValue({ id: pullRequestId });

      const expectedWaitSeconds = 120;
      const expectedDate = new Date(new Date(updatedAt).getTime() + expectedWaitSeconds * MS_PER_SECOND);

      deps.systemStateRepo.getState.mockResolvedValue(undefined);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.systemStateRepo.setState).toHaveBeenCalledTimes(1);
      expect(deps.systemStateRepo.setState).toHaveBeenCalledWith('next_review_available_at' as StateKey, expectedDate);
      expect(deps.systemStateRepo.getState).toHaveBeenCalledWith('next_review_available_at' as StateKey);
    });

    it('picks the earliest candidate across multiple comments', async () => {
      const earlyDate = getUniqueDate();
      const laterDate = new Date(earlyDate.getTime() + MS_PER_HOUR);
      const earlyComment = generateDetectedCommentHydrationData({ updatedAt: earlyDate.toISOString() });
      const laterComment = generateDetectedCommentHydrationData({ updatedAt: laterDate.toISOString() });
      const bodyText = 'rate limited by coderabbit.ai Please wait 10 minutes before requesting another review.';
      deps.github.searchReviewLimitComments.mockResolvedValue([earlyComment, laterComment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, updatedAt: earlyComment.updatedAt });
      deps.pullRequests.findByRepoAndPr.mockResolvedValue({ id: pullRequestId });

      const expectedWaitSeconds = 600;
      const expectedDate = new Date(new Date(earlyComment.updatedAt).getTime() + expectedWaitSeconds * 1000);

      deps.systemStateRepo.getState.mockResolvedValue(undefined);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.systemStateRepo.setState).toHaveBeenCalledTimes(1);
      expect(deps.systemStateRepo.setState).toHaveBeenCalledWith('next_review_available_at' as StateKey, expectedDate);
      expect(deps.onDetected).toHaveBeenCalledTimes(2);
    });
  });
});
