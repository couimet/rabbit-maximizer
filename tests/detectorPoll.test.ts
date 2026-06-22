import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { CoderabbitGitHubClient } from "../src/github/coderabbitGitHubClient.js";
import type { QueueRepository } from "../src/db/queueRepository.js";
import type { ProbeFactory } from "../src/probes/ProbeFactory.js";
import type { Logger } from "@couimet/logger-contract";
import type { RateLimitComment } from "../src/types/RateLimitComment.js";
import type { DetectedProbe } from "../src/probes/DetectedProbe.js";
import { PollDetector } from "../src/detectorPoll.js";
import { createMockLogger } from "./helpers/createMockLogger.js";
import { getUniqueInt, getUniqueString } from "@couimet/dynamic-testing";

const DEFAULT_FALLBACK_WAIT_SECONDS = 3600;
const POLL_INTERVAL_SEC = 90;
const POLL_INTERVAL_MS = POLL_INTERVAL_SEC * 1000;
const EXPECTED_REPO_COUNT = 1;
const MS_PER_SECOND = 1000;
const TICK_DEPTH = 6;

interface MockDetectorDeps {
  github: CoderabbitGitHubClient;
  queue: QueueRepository;
  probes: ProbeFactory;
  probe: {
    processStarted: jest.Mock<() => Promise<void>>;
    processCompleted: jest.Mock<() => Promise<unknown>>;
  };
  logger: Logger;
}

const makeComment = (overrides: {
  commentId?: number;
  repoFullName?: string;
  prNumber?: number;
  createdAt?: string;
}): RateLimitComment => ({
  url: getUniqueString({ prefix: "https://gh/c/" }),
  repo_full_name:
    overrides.repoFullName ??
    `${getUniqueString({ prefix: "org" })}/${getUniqueString({ prefix: "repo" })}`,
  pr_number: overrides.prNumber ?? getUniqueInt(),
  comment_id: overrides.commentId ?? getUniqueInt(),
  created_at: overrides.createdAt ?? new Date().toISOString(),
});

const setup = (): MockDetectorDeps => {
  const github = {
    searchRateLimitComments:
      jest.fn<CoderabbitGitHubClient["searchRateLimitComments"]>(),
    fetchComment: jest.fn<CoderabbitGitHubClient["fetchComment"]>(),
    postRetrigger: jest.fn<CoderabbitGitHubClient["postRetrigger"]>(),
  } as unknown as CoderabbitGitHubClient;

  const queue = {
    enqueue: jest.fn<QueueRepository["enqueue"]>(),
    getNextDue: jest.fn(),
    markCompleted: jest.fn(),
    reschedule: jest.fn(),
    markFailed: jest.fn(),
    getPendingQueue: jest.fn(),
  } as unknown as QueueRepository;

  const probe = {
    processStarted: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    processCompleted: jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValue({ uuid: getUniqueString() }),
  };

  const probes = {
    createDetectedProbe: jest
      .fn<ProbeFactory["createDetectedProbe"]>()
      .mockReturnValue(probe as unknown as DetectedProbe),
  } as unknown as ProbeFactory;

  const logger = createMockLogger();

  return { github, queue, probes, probe, logger };
};

describe("PollDetector", () => {
  let deps: MockDetectorDeps;

  beforeEach(() => {
    deps = setup();
    jest.useFakeTimers();
  });

  describe("start", () => {
    it("fires the first tick immediately and starts an interval", () => {
      (deps.github.searchRateLimitComments as jest.Mock).mockResolvedValue([]);

      const detector = new PollDetector(
        deps.github,
        deps.queue,
        deps.probes,
        deps.logger,
      );
      const { stop } = detector.start();

      expect(deps.github.searchRateLimitComments).toHaveBeenCalledTimes(1);
      expect(deps.logger.info).toHaveBeenCalledWith(
        {
          fn: "PollDetector.start",
          pollIntervalSec: POLL_INTERVAL_SEC,
          repoCount: EXPECTED_REPO_COUNT,
        },
        "Starting poll detector",
      );

      stop();
    });

    it("stop clears the interval", () => {
      (deps.github.searchRateLimitComments as jest.Mock).mockResolvedValue([]);

      const detector = new PollDetector(
        deps.github,
        deps.queue,
        deps.probes,
        deps.logger,
      );
      const { stop } = detector.start();

      stop();
      jest.advanceTimersByTime(POLL_INTERVAL_MS * 2);

      expect(deps.github.searchRateLimitComments).toHaveBeenCalledTimes(1);
      expect(deps.logger.info).toHaveBeenCalledWith(
        { fn: "PollDetector.stop" },
        "Poll detector stopped",
      );
    });

    it("re-fires on each interval", () => {
      (deps.github.searchRateLimitComments as jest.Mock).mockResolvedValue([]);

      const detector = new PollDetector(
        deps.github,
        deps.queue,
        deps.probes,
        deps.logger,
      );
      const { stop } = detector.start();

      jest.advanceTimersByTime(POLL_INTERVAL_MS);

      jest.advanceTimersByTime(POLL_INTERVAL_MS);

      stop();
      // First tick (immediate) + two interval ticks = 3, but async tick
      // won't have resolved under fake timers; we only confirm the function
      // was called (tick fires synchronously via setInterval callback).
      expect(deps.github.searchRateLimitComments).toHaveBeenCalledTimes(3);
    });
  });

  describe("detection", () => {
    it("fetches body, verifies markers, enqueues with computed scheduledFor, and fires probe", async () => {
      const comment = makeComment({});
      const bodyText = `some text rate limited by coderabbit.ai more text Please wait 5 minutes and 30 seconds before requesting another review.`;
      (deps.github.searchRateLimitComments as jest.Mock).mockResolvedValue([
        comment,
      ]);
      (deps.github.fetchComment as jest.Mock).mockResolvedValue(bodyText);

      const expectedWaitSeconds = 5 * 60 + 30;

      const detector = new PollDetector(
        deps.github,
        deps.queue,
        deps.probes,
        deps.logger,
      );
      detector.start();

      for (let i = 0; i < TICK_DEPTH; i++) {
        await Promise.resolve();
      }

      const [owner, repo] = comment.repo_full_name.split("/");
      expect(deps.github.fetchComment).toHaveBeenCalledWith(
        owner,
        repo,
        comment.comment_id,
      );

      expect(deps.queue.enqueue).toHaveBeenCalledTimes(1);
      const enqueuedRepo = (deps.queue.enqueue as jest.Mock).mock.calls[0][0];
      const enqueuedPr = (deps.queue.enqueue as jest.Mock).mock.calls[0][1];
      const enqueuedScheduledFor = (deps.queue.enqueue as jest.Mock).mock
        .calls[0][2] as Date;
      expect(enqueuedRepo).toBe(comment.repo_full_name);
      expect(enqueuedPr).toBe(comment.pr_number);

      const beforeScheduled = Date.now() + expectedWaitSeconds * MS_PER_SECOND;
      const scheduledMs = enqueuedScheduledFor.getTime();
      expect(Math.abs(scheduledMs - beforeScheduled)).toBeLessThan(
        MS_PER_SECOND,
      );

      expect(deps.probes.createDetectedProbe).toHaveBeenCalledWith({
        repo_full_name: comment.repo_full_name,
        pr_number: comment.pr_number,
        source_ts: new Date(comment.created_at),
        source_comment_url: comment.url,
      });
      expect(deps.probe.processStarted).toHaveBeenCalled();
      expect(deps.probe.processCompleted).toHaveBeenCalled();

      const scheduledForIso = enqueuedScheduledFor.toISOString();

      expect(deps.logger.info).toHaveBeenCalledWith(
        {
          fn: "PollDetector.tick",
          repo: comment.repo_full_name,
          pr: comment.pr_number,
          commentId: comment.comment_id,
          scheduledFor: scheduledForIso,
          waitSeconds: expectedWaitSeconds,
        },
        "Rate-limit comment detected and enqueued",
      );
    });

    it("falls back to DEFAULT_FALLBACK_WAIT_SECONDS when parseWaitSeconds returns undefined", async () => {
      const comment = makeComment({});
      const bodyText = "rate limited by coderabbit.ai but no wait time pattern";
      (deps.github.searchRateLimitComments as jest.Mock).mockResolvedValue([
        comment,
      ]);
      (deps.github.fetchComment as jest.Mock).mockResolvedValue(bodyText);

      const detector = new PollDetector(
        deps.github,
        deps.queue,
        deps.probes,
        deps.logger,
      );
      detector.start();

      for (let i = 0; i < TICK_DEPTH; i++) {
        await Promise.resolve();
      }

      expect(deps.queue.enqueue).toHaveBeenCalledTimes(1);
      const scheduledFor = (deps.queue.enqueue as jest.Mock).mock
        .calls[0][2] as Date;
      const expectedScheduled =
        Date.now() + DEFAULT_FALLBACK_WAIT_SECONDS * MS_PER_SECOND;
      expect(Math.abs(scheduledFor.getTime() - expectedScheduled)).toBeLessThan(
        MS_PER_SECOND,
      );

      const scheduledForIso = scheduledFor.toISOString();

      expect(deps.logger.info).toHaveBeenCalledWith(
        {
          fn: "PollDetector.tick",
          repo: comment.repo_full_name,
          pr: comment.pr_number,
          commentId: comment.comment_id,
          scheduledFor: scheduledForIso,
          waitSeconds: DEFAULT_FALLBACK_WAIT_SECONDS,
        },
        "Rate-limit comment detected and enqueued",
      );
    });
  });

  describe("dedup", () => {
    it("skips comments already in seenCommentIds on subsequent ticks", async () => {
      const comment = makeComment({});
      const bodyText =
        "rate limited by coderabbit.ai Please wait 1 minute before requesting another review.";
      (deps.github.searchRateLimitComments as jest.Mock).mockResolvedValue([
        comment,
      ]);
      (deps.github.fetchComment as jest.Mock).mockResolvedValue(bodyText);

      const detector = new PollDetector(
        deps.github,
        deps.queue,
        deps.probes,
        deps.logger,
      );
      detector.start();

      for (let i = 0; i < TICK_DEPTH; i++) {
        await Promise.resolve();
      }

      expect(deps.queue.enqueue).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(POLL_INTERVAL_MS);
      for (let i = 0; i < TICK_DEPTH; i++) {
        await Promise.resolve();
      }

      expect(deps.queue.enqueue).toHaveBeenCalledTimes(1);
    });
  });

  describe("self-marker exclusion", () => {
    it("skips comments whose full body contains the own-retrigger marker", async () => {
      const comment = makeComment({});
      const bodyText =
        "rate limited by coderabbit.ai <!-- rabbit-optimizer already processed -->";
      (deps.github.searchRateLimitComments as jest.Mock).mockResolvedValue([
        comment,
      ]);
      (deps.github.fetchComment as jest.Mock).mockResolvedValue(bodyText);

      const detector = new PollDetector(
        deps.github,
        deps.queue,
        deps.probes,
        deps.logger,
      );
      detector.start();

      for (let i = 0; i < TICK_DEPTH; i++) {
        await Promise.resolve();
      }

      expect(deps.queue.enqueue).not.toHaveBeenCalled();
      expect(deps.probes.createDetectedProbe).not.toHaveBeenCalled();
    });

    it("skips comments that lack the rate-limit marker in the full body", async () => {
      const comment = makeComment({});
      const bodyText = "some unrelated comment body";
      (deps.github.searchRateLimitComments as jest.Mock).mockResolvedValue([
        comment,
      ]);
      (deps.github.fetchComment as jest.Mock).mockResolvedValue(bodyText);

      const detector = new PollDetector(
        deps.github,
        deps.queue,
        deps.probes,
        deps.logger,
      );
      detector.start();

      for (let i = 0; i < TICK_DEPTH; i++) {
        await Promise.resolve();
      }

      expect(deps.queue.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("logs rate-limit warning when API returns 403 with exhausted quota and sets backoff", async () => {
      const resetEpoch = Math.ceil(Date.now() / MS_PER_SECOND) + 120;
      const retryAfterMs = Math.max(0, resetEpoch * MS_PER_SECOND - Date.now());
      const expectedRetryAfterSec = Math.ceil(retryAfterMs / MS_PER_SECOND);
      const rateLimitError = {
        status: 403,
        response: {
          headers: {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": String(resetEpoch),
          },
        },
      };
      (deps.github.searchRateLimitComments as jest.Mock).mockRejectedValue(
        rateLimitError,
      );

      const detector = new PollDetector(
        deps.github,
        deps.queue,
        deps.probes,
        deps.logger,
      );
      detector.start();

      for (let i = 0; i < TICK_DEPTH; i++) {
        await Promise.resolve();
      }

      expect(deps.logger.warn).toHaveBeenCalledWith(
        {
          fn: "PollDetector.tick",
          status: 403,
          retryAfterSec: expectedRetryAfterSec,
        },
        "GitHub API rate limit exhausted; backing off until reset",
      );

      expect(deps.github.searchRateLimitComments).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(POLL_INTERVAL_MS);
      await Promise.resolve();

      expect(deps.github.searchRateLimitComments).toHaveBeenCalledTimes(1);
    });

    it("logs rate-limit warning when API returns 429", async () => {
      const resetEpoch = Math.ceil(Date.now() / MS_PER_SECOND) + 60;
      const retryAfterMs = Math.max(0, resetEpoch * MS_PER_SECOND - Date.now());
      const expectedRetryAfterSec = Math.ceil(retryAfterMs / MS_PER_SECOND);
      const rateLimitError = {
        status: 429,
        response: {
          headers: {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": String(resetEpoch),
          },
        },
      };
      (deps.github.searchRateLimitComments as jest.Mock).mockRejectedValue(
        rateLimitError,
      );

      const detector = new PollDetector(
        deps.github,
        deps.queue,
        deps.probes,
        deps.logger,
      );
      detector.start();

      for (let i = 0; i < TICK_DEPTH; i++) {
        await Promise.resolve();
      }

      expect(deps.logger.warn).toHaveBeenCalledWith(
        {
          fn: "PollDetector.tick",
          status: 429,
          retryAfterSec: expectedRetryAfterSec,
        },
        "GitHub API rate limit exhausted; backing off until reset",
      );
    });

    it("logs generic warning for non-rate-limit errors and continues", async () => {
      (deps.github.searchRateLimitComments as jest.Mock).mockRejectedValue(
        new Error("Network error"),
      );

      const detector = new PollDetector(
        deps.github,
        deps.queue,
        deps.probes,
        deps.logger,
      );
      detector.start();

      for (let i = 0; i < TICK_DEPTH; i++) {
        await Promise.resolve();
      }

      expect(deps.logger.warn).toHaveBeenCalledWith(
        {
          fn: "PollDetector.tick",
          error: "Network error",
        },
        "Poll tick failed; will retry on next interval",
      );
    });

    it("stringifies non-Error throwables for logging", async () => {
      (deps.github.searchRateLimitComments as jest.Mock).mockRejectedValue(
        "plain string failure",
      );

      const detector = new PollDetector(
        deps.github,
        deps.queue,
        deps.probes,
        deps.logger,
      );
      detector.start();

      for (let i = 0; i < TICK_DEPTH; i++) {
        await Promise.resolve();
      }

      expect(deps.logger.warn).toHaveBeenCalledWith(
        {
          fn: "PollDetector.tick",
          error: "plain string failure",
        },
        "Poll tick failed; will retry on next interval",
      );
    });

    it("does not crash the interval on error", async () => {
      (deps.github.searchRateLimitComments as jest.Mock).mockRejectedValue(
        new Error("Boom"),
      );

      const detector = new PollDetector(
        deps.github,
        deps.queue,
        deps.probes,
        deps.logger,
      );
      detector.start();

      for (let i = 0; i < TICK_DEPTH; i++) {
        await Promise.resolve();
      }

      (deps.github.searchRateLimitComments as jest.Mock).mockResolvedValue([]);

      jest.advanceTimersByTime(POLL_INTERVAL_MS);

      expect(deps.github.searchRateLimitComments).toHaveBeenCalledTimes(2);
    });
  });
});
