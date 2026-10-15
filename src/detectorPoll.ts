import { type CoderabbitCommentRepository, type PullRequestRepository, type SystemStateRepository } from './db/index.js';
import {
  type CoderabbitCommentClassifier,
  type CoderabbitGitHubClient,
  hasOwnRetriggerMarker,
  parseGitHubRateLimitError,
  parseWaitSeconds,
  splitRepo,
} from './github/index.js';
import type { OnDetectedCallback, TickGuardOutcome } from './types/index.js';
import { mergeByPullRequestId, MS_PER_SECOND } from './utils/index.js';
import { config } from './config.js';
import { CodeRabbitCommentType, TickGuardReason } from './domain.js';
import { IntervalService, TYPES } from './server-domain.js';
import type { DirectCommentChecker, PrScanner, StalePrRecoverer } from './services.js';

import type { Logger, LoggingContext } from '@couimet/logger-contract';
import { inject, injectable } from 'inversify';

const POLL_INTERVAL_MS = config.POLL_INTERVAL_SEC * MS_PER_SECOND;

/**
 * Wait applied when GitHub throttles a request and the response carries no
 * delay of its own. GitHub documents one minute as the minimum wait after a
 * secondary rate limit, and a secondary-limit response can omit the
 * retry-after header that would name an exact wait.
 */
const SECONDARY_LIMIT_FALLBACK_WAIT_SEC = 60;

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
    @inject(TYPES.DirectCommentChecker)
    private readonly directCommentChecker: DirectCommentChecker,
    @inject(TYPES.OnDetectedCallback)
    private readonly onDetected: OnDetectedCallback,
    @inject(TYPES.PullRequestRepository)
    private readonly pullRequests: PullRequestRepository,
    @inject(TYPES.SystemStateRepository)
    private readonly systemStateRepo: SystemStateRepository,
    @inject(TYPES.CoderabbitCommentRepository)
    private readonly coderabbitComments: CoderabbitCommentRepository,
    @inject(TYPES.CoderabbitCommentClassifier)
    private readonly classifier: CoderabbitCommentClassifier,
    @inject(TYPES.Logger) log: Logger,
  ) {
    super('poll-detector', POLL_INTERVAL_MS, log);
  }
  /* c8 ignore stop */

  protected onStart(): void {
    this.log.info({ fn: 'PollDetector.start', pollIntervalSec: config.POLL_INTERVAL_SEC, repoCount: config.REPO_FILTER.length }, 'Starting poll detector');
  }

  protected onStop(): void {
    this.log.info({ fn: 'PollDetector.stop' }, 'Poll detector stopped');
  }

  protected tickGuard(): TickGuardOutcome {
    const base = super.tickGuard();
    if (!base.allowed) {
      return base;
    }

    const now = Date.now();
    if (now < this.rateLimitRetryAfter) {
      return { allowed: false, reason: TickGuardReason.rateLimit, retryAfterMs: this.rateLimitRetryAfter - now };
    }
    return { allowed: true };
  }

  /**
   * Reports false when the tick must stop, which happens when the quota read
   * itself reports a rate limit and sets the backoff.
   */
  private async logQuota(logCtx: LoggingContext): Promise<boolean> {
    try {
      const quota = await this.github.getQuota();
      this.log.info(
        { ...logCtx, resource: quota.resource, limit: quota.limit, remaining: quota.remaining, used: quota.used, resetEpoch: quota.resetEpoch },
        'GitHub API quota',
      );
      return true;
    } catch (err: unknown) {
      if (this.applyRateLimitBackoff(err, logCtx)) {
        return false;
      }
      this.log.warn({ ...logCtx, error: err }, 'Quota read failed; continuing');
      return true;
    }
  }

  /**
   * Applies the polling backoff when the error reports a GitHub rate limit.
   * Reports true for a rate limit, so the caller stops the tick before touching
   * the GitHub API again. The guard holds the backoff, so later ticks stay
   * suppressed until the wait elapses.
   */
  private applyRateLimitBackoff(err: unknown, logCtx: LoggingContext): boolean {
    const rateLimit = parseGitHubRateLimitError(err);
    if (!rateLimit) {
      return false;
    }

    const retryAfterMs =
      rateLimit.kind === 'quota-exhausted'
        ? Math.max(0, rateLimit.resetEpoch * MS_PER_SECOND - Date.now())
        : (rateLimit.retryAfterSec ?? SECONDARY_LIMIT_FALLBACK_WAIT_SEC) * MS_PER_SECOND;

    this.rateLimitRetryAfter = Date.now() + retryAfterMs;
    this.log.warn(
      {
        ...logCtx,
        kind: rateLimit.kind,
        status: rateLimit.status,
        retryAfterSec: Math.ceil(retryAfterMs / MS_PER_SECOND),
        resetEpoch: rateLimit.kind === 'quota-exhausted' ? rateLimit.resetEpoch : undefined,
        resource: rateLimit.resource,
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        used: rateLimit.used,
      },
      'GitHub API rate limit exhausted; backing off until reset',
    );
    return true;
  }

  protected async executeTick(): Promise<void> {
    const logCtx: LoggingContext = { fn: 'PollDetector.tick' };
    if (!(await this.logQuota(logCtx))) {
      return;
    }

    try {
      const { scannedPRs } = await this.prScanner.scan();
      const stalePRs = await this.stalePrRecoverer.recover();

      const mergedPRs = mergeByPullRequestId(scannedPRs, stalePRs);
      const directCandidates = await this.directCommentChecker.check(mergedPRs);

      const comments = await this.github.searchReviewLimitComments(config.REPO_FILTER);
      let earliestNextReview: Date | undefined;

      for (const c of comments) {
        const { owner, repo } = splitRepo(c.repoFullName);
        const { body } = await this.github.fetchComment(owner, repo, c.commentId);

        const { classification } = this.classifier.classify(body);

        if (classification === CodeRabbitCommentType.unknown) {
          this.log.debug({ ...logCtx, owner, repo, commentId: c.commentId }, 'Skipping comment with unknown classification');
          continue;
        }

        if (classification === CodeRabbitCommentType.review_limited && hasOwnRetriggerMarker(body)) {
          this.log.debug({ ...logCtx, owner, repo, commentId: c.commentId }, 'Skipping comment with own retrigger marker');
          continue;
        }

        if (classification === CodeRabbitCommentType.review_limited) {
          const waitSeconds = parseWaitSeconds(body);
          const effectiveWait = waitSeconds ?? config.REVIEW_LIMIT_FALLBACK_WAIT_SEC;
          const candidate = new Date(new Date(c.updatedAt).getTime() + effectiveWait * MS_PER_SECOND);
          if (!earliestNextReview || candidate < earliestNextReview) {
            earliestNextReview = candidate;
          }
        }

        const existingPr = await this.pullRequests.findByRepoAndPr(c.repoFullName, c.prNumber, undefined);
        if (!existingPr) {
          this.log.warn({ ...logCtx, repo: c.repoFullName, pr: c.prNumber }, 'PR not registered; skipping comment');
          continue;
        }

        const stored = await this.coderabbitComments.findByCommentId(existingPr.id, c.commentId);
        if (stored && new Date(c.updatedAt) <= stored.last_seen_at) {
          this.log.debug({ ...logCtx, owner, repo, commentId: c.commentId }, 'Skipping comment already seen');
          continue;
        }

        await this.onDetected({ ...c, body, commentType: classification }, existingPr.id);
      }

      for (const c of directCandidates) {
        const effectiveWait = c.waitSeconds ?? config.REVIEW_LIMIT_FALLBACK_WAIT_SEC;
        const candidate = new Date(c.updatedAt.getTime() + effectiveWait * MS_PER_SECOND);
        if (!earliestNextReview || candidate < earliestNextReview) {
          earliestNextReview = candidate;
        }
      }

      // The acknowledgement walk below can stop the tick, so record the cooldown first.
      if (earliestNextReview) {
        await this.systemStateRepo.setNextReviewAvailableAtIfLater(earliestNextReview, undefined);
      }

      try {
        const pendingAcks = await this.pullRequests.findPendingAcknowledgements(undefined);
        for (const pendingAck of pendingAcks) {
          try {
            const { owner, repo } = splitRepo(pendingAck.repo_full_name);
            const ack = await this.github.findAcknowledgement(owner, repo, pendingAck.pr_number, pendingAck.last_review_requested_at);
            if (ack) {
              await this.pullRequests.recordAcknowledgement(pendingAck.id);
            }
          } catch (err: unknown) {
            // A rate limit must still stop the whole tick, so the per-PR catch cannot swallow it.
            if (this.applyRateLimitBackoff(err, logCtx)) {
              return;
            }
            this.log.warn(
              { ...logCtx, repo: pendingAck.repo_full_name, pr: pendingAck.pr_number, error: err },
              'Acknowledgement check failed for PR; continuing',
            );
          }
        }
      } catch (err: unknown) {
        this.log.warn({ ...logCtx, error: err }, 'Acknowledgement query failed; continuing');
      }
    } catch (err: unknown) {
      if (this.applyRateLimitBackoff(err, logCtx)) {
        return;
      }

      this.log.warn({ ...logCtx, error: err }, 'Poll tick failed; will retry on next interval');
    }
  }
}
