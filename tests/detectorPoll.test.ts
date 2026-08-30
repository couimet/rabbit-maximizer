import { config } from '../src/config.js';
import type { CoderabbitGitHubClient } from '../src/github/index.js';
import { type DirectCommentChecker, PollDetector } from '../src/services.js';
import type { DetectedComment, OnDetectedCallback } from '../src/types/index.js';

import {
  createMockCoderabbitCommentRepo,
  createMockCoderabbitGitHubClient,
  createMockDirectCommentChecker,
  createMockOnDetectedCallback,
  createMockPrScanner,
  createMockPullRequestRepo,
  createMockStalePrRecoverer,
  createMockSystemStateRepository,
  drainMicrotasks,
  generateDetectedCommentHydrationData,
  generateReviewRef,
} from './helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
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
  directCommentChecker: jest.Mocked<DirectCommentChecker>;
  github: jest.Mocked<CoderabbitGitHubClient>;
  onDetected: jest.Mocked<OnDetectedCallback>;
  prScanner: ReturnType<typeof createMockPrScanner>;
  pullRequests: ReturnType<typeof createMockPullRequestRepo>;
  stalePrRecoverer: ReturnType<typeof createMockStalePrRecoverer>;
  systemStateRepo: ReturnType<typeof createMockSystemStateRepository>;
  coderabbitComments: ReturnType<typeof createMockCoderabbitCommentRepo>;
  logger: Logger;
}

const setup = (): MockDetectorDeps => {
  const directCommentChecker = createMockDirectCommentChecker();
  const github = createMockCoderabbitGitHubClient();

  const onDetected = createMockOnDetectedCallback();
  const prScanner = createMockPrScanner();
  const pullRequests = createMockPullRequestRepo();
  const stalePrRecoverer = createMockStalePrRecoverer();
  const systemStateRepo = createMockSystemStateRepository();
  const coderabbitComments = createMockCoderabbitCommentRepo();
  const logger = createMockLogger();

  return { directCommentChecker, github, onDetected, prScanner, pullRequests, stalePrRecoverer, systemStateRepo, coderabbitComments, logger };
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
    new PollDetector(
      deps.github,
      deps.prScanner,
      deps.stalePrRecoverer,
      deps.directCommentChecker,
      deps.onDetected,
      deps.pullRequests,
      deps.systemStateRepo,
      deps.coderabbitComments,
      deps.logger,
    );

  describe('start', () => {
    it('fires the first tick immediately and starts an interval', async () => {
      deps.github.searchReviewLimitComments.mockResolvedValue([]);

      const detector = createDetector();
      const { stop } = await detector.start();

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
      const { stop } = await detector.start();

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
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, createdAt: comment.createdAt, updatedAt: comment.updatedAt });
      deps.pullRequests.findByRepoAndPr.mockResolvedValue({ id: pullRequestId, head_sha: null });

      const detector = createDetector();
      await detector.start();

      await drainMicrotasks(TICK_DEPTH);

      const [owner, repo] = comment.repoFullName.split('/');
      expect(deps.github.fetchComment).toHaveBeenCalledWith(owner, repo, comment.commentId);
      expect(deps.onDetected).toHaveBeenCalledWith({ ...comment, body: bodyText, commentType: 'review_limited' }, pullRequestId);
    });

    it('detects comment even when parseWaitSeconds returns undefined', async () => {
      const comment = generateDetectedCommentHydrationData();
      const bodyText = 'rate limited by coderabbit.ai but no wait time pattern';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, createdAt: comment.createdAt, updatedAt: comment.updatedAt });
      deps.pullRequests.findByRepoAndPr.mockResolvedValue({ id: pullRequestId, head_sha: null });

      const detector = createDetector();
      await detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.onDetected).toHaveBeenCalledWith({ ...comment, body: bodyText, commentType: 'review_limited' }, pullRequestId);
      expect(deps.systemStateRepo.setNextReviewAvailableAtIfLater).toHaveBeenCalledWith(
        new Date(new Date(comment.updatedAt).getTime() + config.REVIEW_LIMIT_FALLBACK_WAIT_SEC * MS_PER_SECOND),
        undefined,
      );
    });

    it('scans for PRs at the top of executeTick', async () => {
      deps.github.searchReviewLimitComments.mockResolvedValue([]);

      const detector = createDetector();
      await detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.prScanner.scan).toHaveBeenCalled();
      expect(deps.github.searchReviewLimitComments).toHaveBeenCalled();
      expect(deps.prScanner.scan.mock.invocationCallOrder[0]).toBeLessThan(deps.github.searchReviewLimitComments.mock.invocationCallOrder[0]);
    });

    it('calls stalePrRecoverer.recover() after scan', async () => {
      deps.github.searchReviewLimitComments.mockResolvedValue([]);

      const detector = createDetector();
      await detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.prScanner.scan.mock.invocationCallOrder[0]).toBeLessThan(deps.stalePrRecoverer.recover.mock.invocationCallOrder[0]);
    });

    it('skips comment when PR is not registered', async () => {
      const comment = generateDetectedCommentHydrationData();
      const bodyText = 'rate limited by coderabbit.ai some text';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, createdAt: comment.createdAt, updatedAt: comment.updatedAt });

      const detector = createDetector();
      await detector.start();

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
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, createdAt: comment.createdAt, updatedAt: comment.updatedAt });
      deps.pullRequests.findByRepoAndPr.mockResolvedValue({ id: pullRequestId, head_sha: null });

      const detector = createDetector();
      await detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.onDetected).toHaveBeenCalledWith({ ...comment, body: bodyText, commentType: 'review_limited' }, pullRequestId);
    });
  });

  describe('self-marker exclusion', () => {
    it('skips comments whose full body contains the own-retrigger marker', async () => {
      const comment = generateDetectedCommentHydrationData();
      const bodyText = 'rate limited by coderabbit.ai <!-- rabbit-maximizer already processed -->';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, createdAt: comment.createdAt, updatedAt: comment.updatedAt });

      const detector = createDetector();
      await detector.start();

      await drainMicrotasks(TICK_DEPTH);

      const [owner, repo] = comment.repoFullName.split('/');
      expect(deps.onDetected).not.toHaveBeenCalled();
      expect(deps.logger.debug).toHaveBeenCalledWith(
        { fn: 'PollDetector.tick', owner, repo, commentId: comment.commentId },
        'Skipping comment with own retrigger marker',
      );
    });

    it('skips comments with unknown classification', async () => {
      const comment = generateDetectedCommentHydrationData();
      const bodyText = 'some unrelated comment body';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, createdAt: comment.createdAt, updatedAt: comment.updatedAt });

      const detector = createDetector();
      await detector.start();

      await drainMicrotasks(TICK_DEPTH);

      const [owner, repo] = comment.repoFullName.split('/');
      expect(deps.onDetected).not.toHaveBeenCalled();
      expect(deps.logger.debug).toHaveBeenCalledWith(
        { fn: 'PollDetector.tick', owner, repo, commentId: comment.commentId },
        'Skipping comment with unknown classification',
      );
    });

    it('accepts review_skipped comments and fires onDetected callback', async () => {
      const comment = generateDetectedCommentHydrationData();
      const bodyText = 'skip review by coderabbit.ai some additional context';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, createdAt: comment.createdAt, updatedAt: comment.updatedAt });
      deps.pullRequests.findByRepoAndPr.mockResolvedValue({ id: pullRequestId, head_sha: null });

      const detector = createDetector();
      await detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.onDetected).toHaveBeenCalledWith({ ...comment, body: bodyText, commentType: 'review_skipped' }, pullRequestId);
    });
  });

  describe('search path freshness gate', () => {
    it('skips an already-seen comment when updatedAt is not newer than last_seen_at', async () => {
      const comment = generateDetectedCommentHydrationData();
      const bodyText = 'skip review by coderabbit.ai some additional context';
      const lastSeenAt = new Date(new Date(comment.updatedAt).getTime() + MS_PER_SECOND);
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, createdAt: comment.createdAt, updatedAt: comment.updatedAt });
      deps.pullRequests.findByRepoAndPr.mockResolvedValue({ id: pullRequestId, head_sha: null });
      deps.coderabbitComments.findByCommentId.mockResolvedValue({ last_seen_at: lastSeenAt } as any);

      const detector = createDetector();
      await detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.coderabbitComments.findByCommentId).toHaveBeenCalledWith(pullRequestId, comment.commentId);
      expect(deps.onDetected).not.toHaveBeenCalled();
      const [owner, repo] = comment.repoFullName.split('/');
      expect(deps.logger.debug).toHaveBeenCalledWith({ fn: 'PollDetector.tick', owner, repo, commentId: comment.commentId }, 'Skipping comment already seen');
    });

    it('fires onDetected when the comment is newer than the stored last_seen_at', async () => {
      const comment = generateDetectedCommentHydrationData();
      const bodyText = 'skip review by coderabbit.ai some additional context';
      const lastSeenAt = new Date(new Date(comment.updatedAt).getTime() - MS_PER_SECOND);
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, createdAt: comment.createdAt, updatedAt: comment.updatedAt });
      deps.pullRequests.findByRepoAndPr.mockResolvedValue({ id: pullRequestId, head_sha: null });
      deps.coderabbitComments.findByCommentId.mockResolvedValue({ last_seen_at: lastSeenAt } as any);

      const detector = createDetector();
      await detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.onDetected).toHaveBeenCalledWith({ ...comment, body: bodyText, commentType: 'review_skipped' }, pullRequestId);
    });
  });

  describe('acknowledgement check', () => {
    it('checks for pending acknowledgements and records them when found', async () => {
      const ackRef = generateReviewRef();
      const ackId = getUniqueInt();
      const ackCommentId = getUniqueInt();
      const ackCommentUrl = getUniqueString({ prefix: 'https://gh/c/' });
      const [ackOwner, ackRepoName] = ackRef.repoFullName.split('/');
      const pendingAck = { id: ackId, repo_full_name: ackRef.repoFullName, pr_number: ackRef.prNumber, last_review_requested_at: getUniqueDate() };
      const ackResult = { commentId: ackCommentId, commentUrl: ackCommentUrl };
      deps.github.searchReviewLimitComments.mockResolvedValue([]);
      deps.pullRequests.findPendingAcknowledgement.mockResolvedValue(pendingAck);
      deps.github.findAcknowledgement.mockResolvedValue(ackResult);
      const detector = createDetector();
      await detector.start();
      await drainMicrotasks(TICK_DEPTH);
      expect(deps.github.findAcknowledgement).toHaveBeenCalledWith(ackOwner, ackRepoName, ackRef.prNumber, pendingAck.last_review_requested_at);
      expect(deps.pullRequests.recordAcknowledgement).toHaveBeenCalledWith(ackId);
    });

    it('logs a warning and continues when acknowledgement check fails', async () => {
      const ackError = new Error('DB connection lost');
      deps.github.searchReviewLimitComments.mockResolvedValue([]);
      deps.pullRequests.findPendingAcknowledgement.mockRejectedValue(ackError);
      const detector = createDetector();
      await detector.start();
      await drainMicrotasks(TICK_DEPTH);
      expect(deps.logger.warn).toHaveBeenCalledWith({ fn: 'PollDetector.tick', error: ackError }, 'Acknowledgement check failed; continuing');
    });
  });

  describe('directCommentCheck', () => {
    it('calls directCommentChecker.check with merged scan and recover results', async () => {
      const ref = generateReviewRef();
      const prId = getUniqueInt();
      deps.prScanner.scan.mockResolvedValue({
        opened: 1,
        updated: 0,
        scannedPRs: [{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId: prId, prTitle: ref.prTitle }],
      });
      deps.github.searchReviewLimitComments.mockResolvedValue([]);

      const detector = createDetector();
      await detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.directCommentChecker.check).toHaveBeenCalledWith([
        { repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId: prId, prTitle: ref.prTitle },
      ]);
    });

    it('calls directCommentChecker.check before the broad search', async () => {
      deps.github.searchReviewLimitComments.mockResolvedValue([]);

      const detector = createDetector();
      await detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.directCommentChecker.check.mock.invocationCallOrder[0]).toBeLessThan(deps.github.searchReviewLimitComments.mock.invocationCallOrder[0]);
    });

    it('deduplicates PRs from scan and recover', async () => {
      const ref = generateReviewRef();
      const sharedId = getUniqueInt();
      deps.prScanner.scan.mockResolvedValue({
        opened: 1,
        updated: 0,
        scannedPRs: [{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId: sharedId, prTitle: ref.prTitle }],
      });
      deps.stalePrRecoverer.recover.mockResolvedValue([
        { id: sharedId, repoFullName: ref.repoFullName, prNumber: ref.prNumber, title: ref.prTitle, lastReviewRequestedAt: getUniqueDate() },
      ]);
      deps.github.searchReviewLimitComments.mockResolvedValue([]);

      const detector = createDetector();
      await detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.directCommentChecker.check).toHaveBeenCalledWith([
        { repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId: sharedId, prTitle: ref.prTitle },
      ]);
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
      const starting = detector.start();

      await Promise.resolve();

      detector['tick']();

      await Promise.resolve();
      await Promise.resolve();

      expect(deps.github.searchReviewLimitComments).toHaveBeenCalledTimes(1);

      resolveSearch!([]);
      const { stop } = await starting;
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
      await detector.start();

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
      await detector.start();

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
      await detector.start();

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
      await detector.start();

      for (let i = 0; i < TICK_DEPTH; i++) {
        await Promise.resolve();
      }

      expect(deps.logger.warn).toHaveBeenCalledWith({ fn: 'PollDetector.tick', error: badHeaderError }, 'Poll tick failed; will retry on next interval');
    });
  });

  describe('system state tracking', () => {
    it('persists the earliest review-limit candidate when candidates exist', async () => {
      const updatedAt = getUniqueDate().toISOString();
      const comment = generateDetectedCommentHydrationData({ updatedAt });
      const bodyText = 'rate limited by coderabbit.ai Please wait 5 minutes and 30 seconds before requesting another review.';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, createdAt: comment.createdAt, updatedAt: comment.updatedAt });
      deps.pullRequests.findByRepoAndPr.mockResolvedValue({ id: pullRequestId, head_sha: null });

      const expectedWaitSeconds = 5 * 60 + 30;
      const expectedDate = new Date(new Date(updatedAt).getTime() + expectedWaitSeconds * MS_PER_SECOND);

      const detector = createDetector();
      await detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.systemStateRepo.setNextReviewAvailableAtIfLater).toHaveBeenCalledWith(expectedDate, undefined);
      expect(deps.onDetected).toHaveBeenCalledWith({ ...comment, body: bodyText, commentType: 'review_limited' }, pullRequestId);
    });

    it('does not persist a cooldown when no review-limit candidates exist', async () => {
      deps.github.searchReviewLimitComments.mockResolvedValue([]);

      const detector = createDetector();
      await detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.systemStateRepo.setNextReviewAvailableAtIfLater).not.toHaveBeenCalled();
    });

    it('picks the earliest candidate across multiple comments', async () => {
      const earlyDate = getUniqueDate();
      const laterDate = new Date(earlyDate.getTime() + MS_PER_HOUR);
      const earlyComment = generateDetectedCommentHydrationData({ updatedAt: earlyDate.toISOString() });
      const laterComment = generateDetectedCommentHydrationData({ updatedAt: laterDate.toISOString() });
      const bodyText = 'rate limited by coderabbit.ai Please wait 10 minutes before requesting another review.';
      deps.github.searchReviewLimitComments.mockResolvedValue([earlyComment, laterComment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, createdAt: earlyComment.createdAt, updatedAt: earlyComment.updatedAt });
      deps.pullRequests.findByRepoAndPr.mockResolvedValue({ id: pullRequestId, head_sha: null });

      const expectedWaitSeconds = 600;
      const expectedDate = new Date(new Date(earlyComment.updatedAt).getTime() + expectedWaitSeconds * 1000);

      const detector = createDetector();
      await detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.systemStateRepo.setNextReviewAvailableAtIfLater).toHaveBeenCalledTimes(1);
      expect(deps.systemStateRepo.setNextReviewAvailableAtIfLater).toHaveBeenCalledWith(expectedDate, undefined);
      expect(deps.onDetected).toHaveBeenCalledTimes(2);
    });

    it('merges direct candidates from DirectCommentChecker into earliestNextReview', async () => {
      deps.github.searchReviewLimitComments.mockResolvedValue([]);
      const directCandidateDate = getUniqueDate();
      deps.directCommentChecker.check.mockResolvedValue([{ updatedAt: directCandidateDate, waitSeconds: 120 }]);

      const detector = createDetector();
      await detector.start();

      await drainMicrotasks(TICK_DEPTH);

      const expectedDate = new Date(directCandidateDate.getTime() + 120 * MS_PER_SECOND);
      expect(deps.systemStateRepo.setNextReviewAvailableAtIfLater).toHaveBeenCalledWith(expectedDate, undefined);
      expect(deps.logger.info).toHaveBeenCalledWith(
        { fn: 'PollDetector.start', pollIntervalSec: POLL_INTERVAL_SEC, repoCount: EXPECTED_REPO_COUNT },
        'Starting poll detector',
      );
    });

    it('uses REVIEW_LIMIT_FALLBACK_WAIT_SEC when direct candidate has no parsed waitSeconds', async () => {
      deps.github.searchReviewLimitComments.mockResolvedValue([]);
      const directCandidateDate = getUniqueDate();
      deps.directCommentChecker.check.mockResolvedValue([{ updatedAt: directCandidateDate, waitSeconds: undefined }]);

      const detector = createDetector();
      await detector.start();

      await drainMicrotasks(TICK_DEPTH);

      const expectedDate = new Date(directCandidateDate.getTime() + config.REVIEW_LIMIT_FALLBACK_WAIT_SEC * MS_PER_SECOND);
      expect(deps.systemStateRepo.setNextReviewAvailableAtIfLater).toHaveBeenCalledWith(expectedDate, undefined);
      expect(deps.logger.info).toHaveBeenCalledWith(
        { fn: 'PollDetector.start', pollIntervalSec: POLL_INTERVAL_SEC, repoCount: EXPECTED_REPO_COUNT },
        'Starting poll detector',
      );
    });

    it('picks earliest candidate across direct and search results', async () => {
      const directEarly = getUniqueDate();
      const searchLater = new Date(directEarly.getTime() + MS_PER_HOUR);
      const searchComment = generateDetectedCommentHydrationData({ updatedAt: searchLater.toISOString() });
      const bodyText = 'rate limited by coderabbit.ai Please wait 10 minutes before requesting another review.';
      deps.github.searchReviewLimitComments.mockResolvedValue([searchComment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, createdAt: searchComment.createdAt, updatedAt: searchComment.updatedAt });
      deps.pullRequests.findByRepoAndPr.mockResolvedValue({ id: pullRequestId, head_sha: null });
      deps.directCommentChecker.check.mockResolvedValue([{ updatedAt: directEarly, waitSeconds: 120 }]);

      const detector = createDetector();
      await detector.start();

      await drainMicrotasks(TICK_DEPTH);

      const directExpected = new Date(directEarly.getTime() + 120 * MS_PER_SECOND);
      const searchExpected = new Date(searchLater.getTime() + 600 * MS_PER_SECOND);
      expect(directExpected.getTime()).toBeLessThan(searchExpected.getTime());
      expect(deps.systemStateRepo.setNextReviewAvailableAtIfLater).toHaveBeenCalledWith(directExpected, undefined);
      expect(deps.logger.info).toHaveBeenCalledWith(
        { fn: 'PollDetector.start', pollIntervalSec: POLL_INTERVAL_SEC, repoCount: EXPECTED_REPO_COUNT },
        'Starting poll detector',
      );
    });
  });
});
