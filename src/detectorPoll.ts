import type { PullRequestRepository } from './db/pullRequestRepository.js';
import type { SystemStateRepository } from './db/systemStateRepository.js';
import { StateKey } from './db/systemStateRepository.js';
import type { CoderabbitGitHubClient } from './github/coderabbitGitHubClient.js';
import { hasOwnRetriggerMarker } from './github/hasOwnRetriggerMarker.js';
import { hasRateLimitMarker } from './github/hasRateLimitMarker.js';
import { parseGitHubRateLimitError } from './github/parseGitHubRateLimitError.js';
import { parseWaitSeconds } from './github/parseWaitSeconds.js';
import { splitRepo } from './github/splitRepo.js';
import type { OnDetectedCallback } from './types/index.js';
import { MS_PER_SECOND } from './utils/durations.js';
import { config } from './config.js';
import { IntervalService } from './IntervalService.js';
import { TYPES } from './inversify-types.js';

import type { Logger, LoggingContext } from '@couimet/logger-contract';
import { inject, injectable } from 'inversify';

const POLL_INTERVAL_MS = config.POLL_INTERVAL_SEC * MS_PER_SECOND;

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
    @inject(TYPES.PullRequestRepository)
    private readonly pullRequests: PullRequestRepository,
    @inject(TYPES.Logger) log: Logger,
  ) {
    super(log, POLL_INTERVAL_MS);
  }
  /* c8 ignore stop */

  protected onStart(): void {
    this.log.info({ fn: 'PollDetector.start', pollIntervalSec: config.POLL_INTERVAL_SEC, repoCount: config.REPO_FILTER.length }, 'Starting poll detector');
  }

  protected onStop(): void {
    this.log.info({ fn: 'PollDetector.stop' }, 'Poll detector stopped');
  }

  protected tickGuard(): boolean {
    return super.tickGuard() && Date.now() >= this.rateLimitRetryAfter;
  }

  protected async executeTick(): Promise<void> {
    const logCtx: LoggingContext = { fn: 'PollDetector.tick' };

    try {
      await this.checkPendingAcknowledgements(logCtx);

      const comments = await this.github.searchReviewLimitComments(config.REPO_FILTER);
      let earliestNextReview: Date | undefined;

      for (const c of comments) {
        const { owner, repo } = splitRepo(c.repo_full_name);
        const body = await this.github.fetchComment(owner, repo, c.comment_id);

        if (!hasRateLimitMarker(body)) {
          this.log.debug({ ...logCtx, owner, repo, commentId: c.comment_id }, 'Skipping comment without rate-limit marker');
          continue;
        }

        if (hasOwnRetriggerMarker(body)) {
          this.log.debug({ ...logCtx, owner, repo, commentId: c.comment_id }, 'Skipping comment with own retrigger marker');
          continue;
        }

        const waitSeconds = parseWaitSeconds(body);
        const effectiveWait = waitSeconds ?? config.REVIEW_LIMIT_FALLBACK_WAIT_SEC;
        const candidate = new Date(new Date(c.updated_at).getTime() + effectiveWait * MS_PER_SECOND);
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
      const rateLimit = parseGitHubRateLimitError(err);

      if (rateLimit) {
        const retryAfterMs = Math.max(0, rateLimit.resetEpoch * MS_PER_SECOND - Date.now());
        this.rateLimitRetryAfter = Date.now() + retryAfterMs;
        this.log.warn(
          { ...logCtx, status: rateLimit.status, retryAfterSec: Math.ceil(retryAfterMs / MS_PER_SECOND) },
          'GitHub API rate limit exhausted; backing off until reset',
        );
        return;
      }

      this.log.warn({ ...logCtx, error: err }, 'Poll tick failed; will retry on next interval');
    }
  }

  private async checkPendingAcknowledgements(logCtx: LoggingContext): Promise<void> {
    const pendingPRs = await this.pullRequests.findPendingAcknowledgement();

    for (const pr of pendingPRs) {
      const { owner, repo } = splitRepo(pr.repo_full_name);

      try {
        const ack = await this.github.findAcknowledgement(owner, repo, pr.pr_number, pr.last_review_requested_at);

        if (ack) {
          await this.pullRequests.recordAcknowledgement(pr.id);
          this.log.info({ ...logCtx, owner, repo, pr: pr.pr_number, acknowledgedAt: ack.acknowledgedAt.toISOString() }, 'CodeRabbit acknowledgement detected');
        }
      } catch (err: unknown) {
        this.log.warn({ ...logCtx, owner, repo, pr: pr.pr_number, error: err }, 'Failed to check acknowledgement; will retry on next tick');
      }
    }
  }
}
