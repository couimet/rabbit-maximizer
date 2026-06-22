import { inject, injectable } from "inversify";
import type { Logger } from "@couimet/logger-contract";
import { TYPES } from "./inversify-types.js";
import type { CoderabbitGitHubClient } from "./github/coderabbitGitHubClient.js";
import type { QueueRepository } from "./db/queueRepository.js";
import type { ProbeFactory } from "./probes/ProbeFactory.js";
import { hasRateLimitMarker } from "./github/hasRateLimitMarker.js";
import { hasOwnRetriggerMarker } from "./github/hasOwnRetriggerMarker.js";
import { parseWaitSeconds } from "./github/parseWaitSeconds.js";
import { splitRepo } from "./github/splitRepo.js";
import { config } from "./config.js";

const DEFAULT_FALLBACK_WAIT_SECONDS = 3600;
const MILLISECONDS_PER_SECOND = 1000;

const POLL_INTERVAL_MS = config.POLL_INTERVAL * MILLISECONDS_PER_SECOND;

@injectable()
export class PollDetector {
  private seenCommentIds = new Set<number>();
  private intervalId: ReturnType<typeof setInterval> | undefined;
  private rateLimitRetryAfter = 0;

  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.CoderabbitGitHubClient)
    private readonly github: CoderabbitGitHubClient,
    @inject(TYPES.QueueRepository)
    private readonly queue: QueueRepository,
    @inject(TYPES.ProbeFactory)
    private readonly probes: ProbeFactory,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  start(): { stop(): void } {
    this.log.info(
      {
        fn: "PollDetector.start",
        pollIntervalSec: config.POLL_INTERVAL,
        repoCount: config.REPO_FILTER.length,
      },
      "Starting poll detector",
    );

    this.tick();

    this.intervalId = setInterval(() => {
      this.tick();
    }, POLL_INTERVAL_MS);

    return { stop: () => this.stop() };
  }

  private stop(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.log.info({ fn: "PollDetector.stop" }, "Poll detector stopped");
  }

  private async tick(): Promise<void> {
    if (Date.now() < this.rateLimitRetryAfter) return;

    try {
      const comments = await this.github.searchRateLimitComments(
        config.REPO_FILTER,
      );

      for (const c of comments) {
        if (this.seenCommentIds.has(c.comment_id)) continue;

        const { owner, repo } = splitRepo(c.repo_full_name);
        const body = await this.github.fetchComment(owner, repo, c.comment_id);

        if (!hasRateLimitMarker(body) || hasOwnRetriggerMarker(body)) {
          this.seenCommentIds.add(c.comment_id);
          continue;
        }

        const waitSeconds = parseWaitSeconds(body);
        const effectiveWait = waitSeconds ?? DEFAULT_FALLBACK_WAIT_SECONDS;
        const scheduledFor = new Date(
          Date.now() + effectiveWait * MILLISECONDS_PER_SECOND,
        );

        await this.queue.enqueue(c.repo_full_name, c.pr_number, scheduledFor);

        const probe = this.probes.createDetectedProbe({
          repo_full_name: c.repo_full_name,
          pr_number: c.pr_number,
          source_ts: new Date(c.created_at),
          source_comment_url: c.url,
        });
        await probe.processStarted();
        await probe.processCompleted();

        this.log.info(
          {
            fn: "PollDetector.tick",
            repo: c.repo_full_name,
            pr: c.pr_number,
            commentId: c.comment_id,
            scheduledFor: scheduledFor.toISOString(),
            waitSeconds: effectiveWait,
          },
          "Rate-limit comment detected and enqueued",
        );

        this.seenCommentIds.add(c.comment_id);
      }
    } catch (err: unknown) {
      const error = err as {
        status?: number;
        response?: { headers?: Record<string, string> };
      };
      if (
        (error.status === 403 || error.status === 429) &&
        error.response?.headers?.["x-ratelimit-remaining"] === "0"
      ) {
        const resetEpoch = Number(error.response.headers["x-ratelimit-reset"]);
        const retryAfterMs = Math.max(
          0,
          resetEpoch * MILLISECONDS_PER_SECOND - Date.now(),
        );
        this.rateLimitRetryAfter = Date.now() + retryAfterMs;
        this.log.warn(
          {
            fn: "PollDetector.tick",
            status: error.status,
            retryAfterSec: Math.ceil(retryAfterMs / MILLISECONDS_PER_SECOND),
          },
          "GitHub API rate limit exhausted; backing off until reset",
        );
        return;
      }

      this.log.warn(
        {
          fn: "PollDetector.tick",
          error: err instanceof Error ? err.message : String(err),
        },
        "Poll tick failed; will retry on next interval",
      );
    }
  }
}
