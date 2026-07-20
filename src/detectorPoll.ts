import type { PullRequestRepository } from './db/pullRequestRepository.js';
import type { SystemStateRepository } from './db/systemStateRepository.js';
import { StateKey } from './db/systemStateRepository.js';
import type { DetectionRouter } from './detection/DetectionRouter.js';
import type { CoderabbitGitHubClient } from './github/coderabbitGitHubClient.js';
import { parseGitHubRateLimitError } from './github/parseGitHubRateLimitError.js';
import { splitRepo } from './github/splitRepo.js';
import type { DetectedComment } from './types/DetectedComment.js';
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
    @inject(TYPES.DetectionRouter)
    private readonly router: DetectionRouter,
    @inject(TYPES.PullRequestRepository)
    private readonly pullRequests: PullRequestRepository,
    @inject(TYPES.SystemStateRepository)
    private readonly systemStateRepo: SystemStateRepository,
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
      const comments = await this.github.searchReviewLimitComments(config.REPO_FILTER);
      let earliestNextReview: Date | undefined;

      for (const c of comments) {
        const { owner, repo } = splitRepo(c.repoFullName);
        const { body, updatedAt } = await this.github.fetchComment(owner, repo, c.commentId);

        const enriched: DetectedComment = { ...c, body, updatedAt };
        const candidate = await this.router.route(enriched);
        if (candidate && (!earliestNextReview || candidate < earliestNextReview)) {
          earliestNextReview = candidate;
        }
      }

      try {
        const pendingAck = await this.pullRequests.findPendingAcknowledgement();
        if (pendingAck) {
          const { owner, repo } = splitRepo(pendingAck.repo_full_name);
          const ack = await this.github.findAcknowledgement(owner, repo, pendingAck.pr_number, pendingAck.last_review_requested_at);
          if (ack) {
            await this.pullRequests.recordAcknowledgement(pendingAck.id);
          }
        }
      } catch (err: unknown) {
        this.log.warn({ ...logCtx, error: err }, 'Acknowledgement check failed; continuing');
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
}
