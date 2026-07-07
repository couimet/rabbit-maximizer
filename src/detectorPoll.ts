import type { SystemStateRepository } from './db/systemStateRepository.js';
import { StateKey } from './db/systemStateRepository.js';
import type { CoderabbitGitHubClient } from './github/coderabbitGitHubClient.js';
import { hasOwnRetriggerMarker } from './github/hasOwnRetriggerMarker.js';
import { hasRateLimitMarker } from './github/hasRateLimitMarker.js';
import { parseWaitSeconds } from './github/parseWaitSeconds.js';
import { splitRepo } from './github/splitRepo.js';
import type { OnDetectedCallback } from './types/index.js';
import { config } from './config.js';
import { IntervalService } from './IntervalService.js';
import { TYPES } from './inversify-types.js';

import type { Logger } from '@couimet/logger-contract';
import { inject, injectable } from 'inversify';

const MILLISECONDS_PER_SECOND = 1000;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const QUOTA_EXHAUSTED = '0';

const POLL_INTERVAL_MS = config.POLL_INTERVAL * MILLISECONDS_PER_SECOND;

@injectable()
export class PollDetector extends IntervalService {
  private rateLimitRetryAfter = 0;

  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.CoderabbitGitHubClient)
    private readonly github: CoderabbitGitHubClient,
    @inject(TYPES.OnDetectedCallback)
    private readonly onDetected: OnDetectedCallback,
    @inject(TYPES.SystemStateRepository)
    private readonly systemStateRepo: SystemStateRepository,
    @inject(TYPES.Logger) log: Logger,
  ) {
    super(log, POLL_INTERVAL_MS);
  }
  /* c8 ignore stop */

  protected onStart(): void {
    this.log.info({ fn: 'PollDetector.start', pollIntervalSec: config.POLL_INTERVAL, repoCount: config.REPO_FILTER.length }, 'Starting poll detector');
  }

  protected onStop(): void {
    this.log.info({ fn: 'PollDetector.stop' }, 'Poll detector stopped');
  }

  protected tickGuard(): boolean {
    return super.tickGuard() && Date.now() >= this.rateLimitRetryAfter;
  }

  protected async executeTick(): Promise<void> {
    try {
      const comments = await this.github.searchReviewLimitComments(config.REPO_FILTER);
      let earliestNextReview: Date | undefined;

      for (const c of comments) {
        const { owner, repo } = splitRepo(c.repo_full_name);
        const body = await this.github.fetchComment(owner, repo, c.comment_id);

        if (!hasRateLimitMarker(body) || hasOwnRetriggerMarker(body)) {
          continue;
        }

        const waitSeconds = parseWaitSeconds(body);
        const effectiveWait = waitSeconds ?? config.REVIEW_LIMIT_FALLBACK_WAIT_SECONDS;
        const candidate = new Date(new Date(c.updated_at).getTime() + effectiveWait * MILLISECONDS_PER_SECOND);
        if (!earliestNextReview || candidate < earliestNextReview) {
          earliestNextReview = candidate;
        }

        await this.onDetected(c, effectiveWait);
      }

      if (earliestNextReview) {
        const existing = await this.systemStateRepo.getState(StateKey.nextReviewAvailableAt);
        const existingIsActive = existing !== undefined && existing.getTime() > Date.now();
        if (!existingIsActive || earliestNextReview < existing) {
          await this.systemStateRepo.setState(StateKey.nextReviewAvailableAt, earliestNextReview);
        }
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
