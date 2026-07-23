import { type PullRequestRepository, StateKey, type SystemStateRepository } from './db/index.js';
import {
  type CoderabbitGitHubClient,
  hasOwnRetriggerMarker,
  hasRateLimitMarker,
  parseGitHubRateLimitError,
  parseWaitSeconds,
  splitRepo,
} from './github/index.js';
import type { OnDetectedCallback } from './types/index.js';
import { MS_PER_SECOND } from './utils/index.js';
import { config } from './config.js';
import { IntervalService, TYPES } from './domain.js';
import type { PrScanner, StalePrRecoverer } from './services.js';

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
    @inject(TYPES.PrScanner)
    private readonly prScanner: PrScanner,
    @inject(TYPES.StalePrRecoverer)
    private readonly stalePrRecoverer: StalePrRecoverer,
    @inject(TYPES.OnDetectedCallback)
    private readonly onDetected: OnDetectedCallback,
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
      await this.prScanner.scan();
      await this.stalePrRecoverer.recover();

      const comments = await this.github.searchReviewLimitComments(config.REPO_FILTER);
      let earliestNextReview: Date | undefined;

      for (const c of comments) {
        const { owner, repo } = splitRepo(c.repoFullName);
        const { body } = await this.github.fetchComment(owner, repo, c.commentId);

        if (!hasRateLimitMarker(body)) {
          this.log.debug({ ...logCtx, owner, repo, commentId: c.commentId }, 'Skipping comment without rate-limit marker');
          continue;
        }

        if (hasOwnRetriggerMarker(body)) {
          this.log.debug({ ...logCtx, owner, repo, commentId: c.commentId }, 'Skipping comment with own retrigger marker');
          continue;
        }

        const waitSeconds = parseWaitSeconds(body);
        const effectiveWait = waitSeconds ?? config.REVIEW_LIMIT_FALLBACK_WAIT_SEC;
        const candidate = new Date(new Date(c.updatedAt).getTime() + effectiveWait * MS_PER_SECOND);
        if (!earliestNextReview || candidate < earliestNextReview) {
          earliestNextReview = candidate;
        }

        const existingPr = await this.pullRequests.findByRepoAndPr(c.repoFullName, c.prNumber);
        if (!existingPr) {
          this.log.warn({ ...logCtx, repo: c.repoFullName, pr: c.prNumber }, 'PR not registered; skipping comment');
          continue;
        }

        await this.onDetected({ ...c, body }, effectiveWait, existingPr.id);
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
