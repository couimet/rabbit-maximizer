import { type CoderabbitCommentRepository, type PullRequestRepository, type SystemStateRepository } from './db/index.js';
import {
  type CoderabbitCommentClassifier,
  type CoderabbitGitHubClient,
  type GitHubRateLimitGate,
  hasOwnRetriggerMarker,
  parseWaitSeconds,
  splitRepo,
} from './github/index.js';
import type { OnDetectedCallback, TickGuardOutcome } from './types/index.js';
import { mergeByPullRequestId, MS_PER_SECOND } from './utils/index.js';
import { config } from './config.js';
import { CodeRabbitCommentType, TickGuardReason } from './domain.js';
import { IntervalService, TYPES } from './server-domain.js';
import type { DirectCommentChecker, HeadDriftRecoverer, PrScanner, StalePrRecoverer } from './services.js';

import type { Logger, LoggingContext } from '@couimet/logger-contract';
import { inject, injectable } from 'inversify';

const POLL_INTERVAL_MS = config.POLL_INTERVAL_SEC * MS_PER_SECOND;

@injectable()
export class PollDetector extends IntervalService {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.CoderabbitGitHubClient)
    private readonly github: CoderabbitGitHubClient,
    @inject(TYPES.PrScanner)
    private readonly prScanner: PrScanner,
    @inject(TYPES.StalePrRecoverer)
    private readonly stalePrRecoverer: StalePrRecoverer,
    @inject(TYPES.HeadDriftRecoverer)
    private readonly headDriftRecoverer: HeadDriftRecoverer,
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
    @inject(TYPES.GitHubRateLimitGate)
    private readonly rateLimitGate: GitHubRateLimitGate,
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

    const retryAfterMs = this.rateLimitGate.retryAfterMs();
    if (retryAfterMs !== undefined) {
      return { allowed: false, reason: TickGuardReason.rateLimit, retryAfterMs };
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
      if (await this.rateLimitGate.recordError(err)) {
        return false;
      }
      this.log.warn({ ...logCtx, error: err }, 'Quota read failed; continuing');
      return true;
    }
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
      if (this.rateLimitGate.isBlocked()) {
        return;
      }

      // Runs after the direct check so a pause enqueue from this tick already holds the PR.
      await this.headDriftRecoverer.recover(new Date(Date.now() - config.HEAD_DRIFT_GRACE_SEC * MS_PER_SECOND));
      if (this.rateLimitGate.isBlocked()) {
        return;
      }

      const comments = await this.github.searchReviewLimitComments(config.REPO_FILTER);
      let earliestNextReview: Date | undefined;

      for (const c of comments) {
        if (this.rateLimitGate.isBlocked()) {
          return;
        }
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
            if (await this.rateLimitGate.recordError(err)) {
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
      if (await this.rateLimitGate.recordError(err)) {
        return;
      }

      this.log.warn({ ...logCtx, error: err }, 'Poll tick failed; will retry on next interval');
    }
  }
}
