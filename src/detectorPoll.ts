import type { CoderabbitGitHubClient } from './github/coderabbitGitHubClient.js';
import { hasOwnRetriggerMarker } from './github/hasOwnRetriggerMarker.js';
import { hasRateLimitMarker } from './github/hasRateLimitMarker.js';
import { parseWaitSeconds } from './github/parseWaitSeconds.js';
import { splitRepo } from './github/splitRepo.js';
import type { OnDetectedCallback } from './types/index.js';
import { getJitter } from './utils/getJitter.js';
import { config } from './config.js';
import { TYPES } from './inversify-types.js';

import type { Logger } from '@couimet/logger-contract';
import { inject, injectable } from 'inversify';

const DEFAULT_FALLBACK_WAIT_SECONDS = 3600;
const MILLISECONDS_PER_SECOND = 1000;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const QUOTA_EXHAUSTED = '0';

const POLL_INTERVAL_MS = config.POLL_INTERVAL * MILLISECONDS_PER_SECOND;

@injectable()
export class PollDetector {
  private seenCommentIds = new Set<number>();
  private intervalId: ReturnType<typeof setInterval> | undefined;
  private rateLimitRetryAfter = 0;
  private tickPromise: Promise<void> | null = null;

  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.CoderabbitGitHubClient)
    private readonly github: CoderabbitGitHubClient,
    @inject(TYPES.OnDetectedCallback)
    private readonly onDetected: OnDetectedCallback,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  start(): { stop(): Promise<void> } {
    this.log.info(
      {
        fn: 'PollDetector.start',
        pollIntervalSec: config.POLL_INTERVAL,
        repoCount: config.REPO_FILTER.length,
      },
      'Starting poll detector',
    );

    this.tick();

    this.intervalId = setInterval(() => {
      this.tick();
    }, POLL_INTERVAL_MS);

    return { stop: () => this.stop() };
  }

  private async stop(): Promise<void> {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    if (this.tickPromise) {
      await this.tickPromise;
    }
    this.log.info({ fn: 'PollDetector.stop' }, 'Poll detector stopped');
  }

  private async tick(): Promise<void> {
    if (this.tickPromise) return;
    if (Date.now() < this.rateLimitRetryAfter) return;
    this.tickPromise = this.executeTick();
    try {
      await this.tickPromise;
    } finally {
      this.tickPromise = null;
    }
  }

  private async executeTick(): Promise<void> {
    try {
      const comments = await this.github.searchRateLimitComments(config.REPO_FILTER);

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
        const jitteredWait = getJitter(effectiveWait);

        await this.onDetected(c, jitteredWait);

        this.seenCommentIds.add(c.comment_id);
      }
    } catch (err: unknown) {
      const error = err as {
        status?: number;
        response?: { headers?: Record<string, string> };
      };
      if (
        (error.status === HTTP_FORBIDDEN || error.status === HTTP_TOO_MANY_REQUESTS) &&
        error.response?.headers?.['x-ratelimit-remaining'] === QUOTA_EXHAUSTED
      ) {
        const resetEpoch = Number(error.response.headers['x-ratelimit-reset']);
        if (Number.isNaN(resetEpoch)) {
          this.log.warn(
            {
              fn: 'PollDetector.tick',
              status: error.status,
            },
            'Rate limit response missing valid x-ratelimit-reset header; skipping backoff',
          );
          return;
        }
        const retryAfterMs = Math.max(0, resetEpoch * MILLISECONDS_PER_SECOND - Date.now());
        this.rateLimitRetryAfter = Date.now() + retryAfterMs;
        this.log.warn(
          {
            fn: 'PollDetector.tick',
            status: error.status,
            retryAfterSec: Math.ceil(retryAfterMs / MILLISECONDS_PER_SECOND),
          },
          'GitHub API rate limit exhausted; backing off until reset',
        );
        return;
      }

      this.log.warn(
        {
          fn: 'PollDetector.tick',
          error: err,
        },
        'Poll tick failed; will retry on next interval',
      );
    }
  }
}
