import type { PullRequestRepository, QueueRepository } from './db/index.js';
import { RabbitMaximizerError } from './errors/index.js';
import { type CoderabbitGitHubClient, splitRepo } from './github/index.js';
import type { ProbeFactory } from './probes/index.js';
import { MS_PER_SECOND, toReviewEventType } from './utils/index.js';
import type { Config } from './config.js';
import { CodeRabbitCommentType, IntervalService, PrState, Resolution, TYPES } from './domain.js';
import type { EditDetector } from './EditDetector.js';

import type { Logger } from '@couimet/logger-contract';
import type { PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';

@injectable()
export class ReviewDetector extends IntervalService {
  private readonly lookbackMs: number;

  /* c8 ignore start */
  constructor(
    @inject(TYPES.QueueRepository) private readonly queue: QueueRepository,
    @inject(TYPES.PullRequestRepository) private readonly pullRequests: PullRequestRepository,
    @inject(TYPES.CoderabbitGitHubClient) private readonly github: CoderabbitGitHubClient,
    @inject(TYPES.EditDetector) private readonly editDetector: EditDetector,
    @inject(TYPES.ProbeFactory) private readonly probeFactory: ProbeFactory,
    @inject(TYPES.PrismaClient) private readonly prisma: PrismaClient,
    @inject(TYPES.Config) cfg: Config,
    @inject(TYPES.Logger) log: Logger,
  ) {
    super(log, cfg.POLL_INTERVAL_SEC * MS_PER_SECOND);
    this.lookbackMs = cfg.REVIEW_DETECTION_LOOKBACK_SEC * MS_PER_SECOND;
  }
  /* c8 ignore stop */

  protected onStart(): void {
    this.log.info({ fn: 'ReviewDetector.start', pollIntervalSec: this.intervalMs / MS_PER_SECOND }, 'Starting review detector');
  }
  protected onStop(): void {
    this.log.info({ fn: 'ReviewDetector.stop' }, 'Review detector stopped');
  }

  protected async executeTick(): Promise<void> {
    const probe = this.probeFactory.createReviewDetectorProbe();
    const retriggeredItems = await this.queue.getRetriggeredQueue();
    if (retriggeredItems.length === 0) {
      probe.noRetriggeredItemFound();
      return;
    }
    const prIds = retriggeredItems.map((item) => item.pull_request_id);
    const { pr_state: prStateMap, last_coderabbit_review_at: lastCoderabbitReviewAtMap } = await this.pullRequests.getColumnMaps(prIds, [
      'pr_state',
      'last_coderabbit_review_at',
    ]);
    for (const item of retriggeredItems) {
      probe.withItem(item);
      try {
        if (item.retriggered_at == null) continue;

        const prState = prStateMap.get(item.pull_request_id);
        if (prState === PrState.merged || prState === PrState.closed) {
          const resolution = prState === PrState.merged ? Resolution.PrMerged : Resolution.PrClosedWithoutMerge;
          await this.prisma.$transaction(async (tx) => {
            await this.queue.markResolved(item.id, resolution, tx);
          });
          probe.prClosedResolved(prState);
          continue;
        }

        const result = await this.editDetector.detectEdit(item);
        if (!result.success) {
          probe.editDetectionFailed(result.error);
          continue;
        }
        const editOutcome = result.value;
        switch (editOutcome.action) {
          case 'resolved':
            await this.prisma.$transaction(async (tx) => {
              await this.queue.markResolved(item.id, Resolution.ReviewCompleted, tx);
              await this.pullRequests.recordReview(item.pull_request_id, editOutcome.reviewUrl, editOutcome.verdictState, tx);
              await probe.reviewed(toReviewEventType(editOutcome.verdictState), editOutcome.reviewUrl, tx);
            });
            continue;
          case 'fallback':
            break;
          default:
            throw RabbitMaximizerError.forUnexpectedSwitchDefault(
              'edit outcome action',
              (editOutcome as { action: string }).action,
              'ReviewDetector.executeTick',
            );
        }

        const lookbackSince = new Date(item.retriggered_at.getTime() - this.lookbackMs);

        const { owner, repo } = splitRepo(item.repo_full_name);
        const completedReview = await this.github.findCompletedReview(owner, repo, item.pr_number, lookbackSince);

        if (!completedReview) {
          const lastCoderabbitReviewAt = lastCoderabbitReviewAtMap.get(item.pull_request_id);
          if (lastCoderabbitReviewAt != null && lastCoderabbitReviewAt >= lookbackSince) {
            await this.prisma.$transaction(async (tx) => {
              await this.queue.markResolved(item.id, Resolution.ReviewCompleted, tx);
              await probe.reviewedViaFallback(tx);
            });
            continue;
          }
          probe.noCompletedReviewFound();
          continue;
        }

        const verdictState = completedReview.isApproval ? CodeRabbitCommentType.review_approved : CodeRabbitCommentType.review_changes_suggested;

        await this.prisma.$transaction(async (tx) => {
          await this.queue.markResolved(item.id, Resolution.ReviewCompleted, tx);
          await this.pullRequests.recordReview(item.pull_request_id, completedReview.htmlUrl, verdictState, tx);
          await probe.reviewed(toReviewEventType(verdictState), completedReview.htmlUrl, tx);
        });
      } catch (err: unknown) {
        probe.caughtError(err);
      }
    }
  }
}
