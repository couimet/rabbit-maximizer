import type { PullRequestRepository, QueueRepository } from './db/index.js';
import { RabbitMaximizerError } from './errors/index.js';
import { type CoderabbitGitHubClient, splitRepo } from './github/index.js';
import type { ProbeFactory } from './probes/index.js';
import { MS_PER_SECOND } from './utils/index.js';
import type { Config } from './config.js';
import { CodeRabbitCommentType, IntervalService, PrState, Resolution, ReviewDetectionMethod, TYPES } from './domain.js';
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
    super('review-detector', log, cfg.POLL_INTERVAL_SEC * MS_PER_SECOND);
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
    const {
      pr_state: prStateMap,
      last_coderabbit_review_at: lastCoderabbitReviewAtMap,
      head_sha: headShaMap,
    } = await this.pullRequests.getColumnMaps(prIds, ['pr_state', 'last_coderabbit_review_at', 'head_sha']);
    for (const item of retriggeredItems) {
      probe.withItem(item);
      try {
        if (item.retriggered_at == null) continue;

        const prState = prStateMap.get(item.pull_request_id);
        if (prState === PrState.merged || prState === PrState.closed) {
          const resolution = prState === PrState.merged ? Resolution.PrMerged : Resolution.PrClosedWithoutMerge;
          const resolved = await this.prisma.$transaction((tx) => this.queue.markResolvedIfStillRetriggered(item.id, resolution, tx));
          if (!resolved) {
            probe.resolutionLostRace(resolution);
            continue;
          }
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
            {
              const resolved = await this.prisma.$transaction(async (tx) => {
                const ok = await this.queue.markResolvedIfStillRetriggered(item.id, Resolution.ReviewCompleted, tx);
                if (!ok) return false;
                await this.pullRequests.recordReview(item.pull_request_id, editOutcome.reviewUrl, editOutcome.verdictState, undefined, tx);
                await probe.reviewed(editOutcome.reviewUrl, editOutcome.verdictState, ReviewDetectionMethod.EditDetection, tx);
                return true;
              });
              if (!resolved) {
                probe.resolutionLostRace(Resolution.ReviewCompleted);
                continue;
              }
            }
            continue;
          case 'skipped':
            {
              const resolved = await this.prisma.$transaction((tx) => this.queue.markResolvedIfStillRetriggered(item.id, Resolution.Skipped, tx));
              if (!resolved) {
                probe.resolutionLostRace(Resolution.Skipped);
                continue;
              }
            }
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
        const completedReview = await this.github.findCompletedReview(
          owner,
          repo,
          item.pr_number,
          lookbackSince,
          item.source_comment_run_id ?? undefined,
          headShaMap.get(item.pull_request_id) ?? undefined,
        );

        if (!completedReview) {
          // The last-review-at fallback only applies when no run is known: a known run
          // that produced nothing yet must stay retriggered for the stale sweep to fail it.
          const lastCoderabbitReviewAt = lastCoderabbitReviewAtMap.get(item.pull_request_id);
          if (item.source_comment_run_id === undefined && lastCoderabbitReviewAt != null && lastCoderabbitReviewAt >= lookbackSince) {
            const resolved = await this.prisma.$transaction(async (tx) => {
              const ok = await this.queue.markResolvedIfStillRetriggered(item.id, Resolution.ReviewCompleted, tx);
              if (!ok) return false;
              await probe.reviewedViaFallback(tx);
              return true;
            });
            if (!resolved) {
              probe.resolutionLostRace(Resolution.ReviewCompleted);
              continue;
            }
            continue;
          }
          probe.noCompletedReviewFound();
          continue;
        }

        const verdictState = completedReview.isApproval ? CodeRabbitCommentType.review_approved : CodeRabbitCommentType.review_changes_suggested;

        const resolved = await this.prisma.$transaction(async (tx) => {
          const ok = await this.queue.markResolvedIfStillRetriggered(item.id, Resolution.ReviewCompleted, tx);
          if (!ok) return false;
          await this.pullRequests.recordReview(item.pull_request_id, completedReview.htmlUrl, verdictState, completedReview.commitId, tx);
          await probe.reviewed(completedReview.htmlUrl, verdictState, ReviewDetectionMethod.GitHubReviewsApi, tx);
          return true;
        });
        if (!resolved) {
          probe.resolutionLostRace(Resolution.ReviewCompleted);
          continue;
        }
      } catch (err: unknown) {
        probe.caughtError(err);
      }
    }
  }
}
