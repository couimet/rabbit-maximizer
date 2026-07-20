import { StateKey } from '../src/db/systemStateRepository.js';
import type { DetectionRouter } from '../src/detection/DetectionRouter.js';
import { PollDetector } from '../src/detectorPoll.js';
import type { CoderabbitGitHubClient } from '../src/github/coderabbitGitHubClient.js';
import type { DetectedComment } from '../src/types/DetectedComment.js';

import {
  createMockCoderabbitGitHubClient,
  createMockPullRequestRepo,
  createMockSystemStateRepository,
  drainMicrotasks,
  makeDetectedComment,
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
const EXPECTED_WAIT_SECONDS = 5 * 60 + 30;

interface MockDetectorDeps {
  github: jest.Mocked<CoderabbitGitHubClient>;
  router: jest.Mocked<DetectionRouter>;
  pullRequests: ReturnType<typeof createMockPullRequestRepo>;
  systemStateRepo: ReturnType<typeof createMockSystemStateRepository>;
  logger: Logger;
}

const setup = (): MockDetectorDeps => {
  const github = createMockCoderabbitGitHubClient();
  const router = { route: jest.fn<any>() } as unknown as jest.Mocked<DetectionRouter>;
  const pullRequests = createMockPullRequestRepo();
  const systemStateRepo = createMockSystemStateRepository();
  const logger = createMockLogger();

  return { github, router, pullRequests, systemStateRepo, logger };
};

describe('PollDetector', () => {
  let deps: MockDetectorDeps;

  beforeEach(() => {
    deps = setup();
    jest.useFakeTimers();
  });

  const createDetector = () => new PollDetector(deps.github, deps.router, deps.pullRequests, deps.systemStateRepo, deps.logger);

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

  describe('detection routing', () => {
    it('fetches comment body, enriches it, and delegates to router', async () => {
      const comment = makeDetectedComment({});
      const bodyText = 'rate limited by coderabbit.ai Please wait 5 minutes and 30 seconds before requesting another review.';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, updatedAt: comment.updatedAt });

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      const [owner, repo] = comment.repoFullName.split('/');
      expect(deps.github.fetchComment).toHaveBeenCalledWith(owner, repo, comment.commentId);
      expect(deps.router.route).toHaveBeenCalledWith({ ...comment, body: bodyText, updatedAt: comment.updatedAt });
    });

    it('aggregates earliestNextReview from router results', async () => {
      const comment = makeDetectedComment({});
      const bodyText = 'rate limited by coderabbit.ai Please wait 5 minutes and 30 seconds before requesting another review.';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, updatedAt: comment.updatedAt });

      const candidateDate = new Date(new Date(comment.updatedAt).getTime() + EXPECTED_WAIT_SECONDS * MS_PER_SECOND);
      deps.router.route.mockResolvedValue(candidateDate);
      deps.systemStateRepo.getState.mockResolvedValue(undefined);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.systemStateRepo.setState).toHaveBeenCalledWith('next_review_available_at' as StateKey, candidateDate);
    });

    it('picks earliest candidate when router returns multiple dates', async () => {
      const earlyDate = getUniqueDate();
      const laterDate = new Date(earlyDate.getTime() + MS_PER_HOUR);
      const earlyComment = makeDetectedComment({ updatedAt: earlyDate.toISOString() });
      const laterComment = makeDetectedComment({ updatedAt: laterDate.toISOString() });
      const bodyText = 'rate limited by coderabbit.ai Please wait 10 minutes before requesting another review.';
      deps.github.searchReviewLimitComments.mockResolvedValue([earlyComment, laterComment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, updatedAt: earlyComment.updatedAt });

      const earlyCandidate = new Date(earlyDate.getTime() + 600 * 1000);
      const laterCandidate = new Date(laterDate.getTime() + 600 * 1000);
      deps.router.route.mockResolvedValueOnce(earlyCandidate).mockResolvedValueOnce(laterCandidate);
      deps.systemStateRepo.getState.mockResolvedValue(undefined);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.systemStateRepo.setState).toHaveBeenCalledWith('next_review_available_at' as StateKey, earlyCandidate);
    });

    it('skips state update when router returns undefined for all comments', async () => {
      const comment = makeDetectedComment({});
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue({ body: 'unrelated body', updatedAt: comment.updatedAt });
      deps.router.route.mockResolvedValue(undefined);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.systemStateRepo.setState).not.toHaveBeenCalled();
    });

    it('updates state when existing nextReviewAvailableAt is inactive', async () => {
      const comment = makeDetectedComment({});
      const bodyText = 'rate limited by coderabbit.ai Please wait 5 minutes before requesting another review.';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, updatedAt: comment.updatedAt });

      const candidateDate = new Date(Date.now() + 60000);
      deps.router.route.mockResolvedValue(candidateDate);
      deps.systemStateRepo.getState.mockResolvedValue(new Date(Date.now() - 3600000));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.systemStateRepo.setState).toHaveBeenCalledWith('next_review_available_at' as StateKey, candidateDate);
    });

    it('skips state update when existing nextReviewAvailableAt is active and earlier', async () => {
      const comment = makeDetectedComment({});
      const bodyText = 'rate limited by coderabbit.ai Please wait 5 minutes before requesting another review.';
      deps.github.searchReviewLimitComments.mockResolvedValue([comment]);
      deps.github.fetchComment.mockResolvedValue({ body: bodyText, updatedAt: comment.updatedAt });

      const laterCandidate = new Date(Date.now() + 600000);
      const earlierActive = new Date(Date.now() + 60000);
      deps.router.route.mockResolvedValue(laterCandidate);
      deps.systemStateRepo.getState.mockResolvedValue(earlierActive);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.systemStateRepo.setState).not.toHaveBeenCalled();
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

    it('logs generic warning for non-rate-limit errors and continues', async () => {
      const networkError = new Error('Network error');
      deps.github.searchReviewLimitComments.mockRejectedValue(networkError);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.logger.warn).toHaveBeenCalledWith({ fn: 'PollDetector.tick', error: networkError }, 'Poll tick failed; will retry on next interval');
    });
  });
});
