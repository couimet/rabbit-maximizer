import type { PullRequestRepository, QueueRepository } from './db/index.js';
import { type CoderabbitGitHubClient, splitRepo } from './github/index.js';
import type { ProbeFactory } from './probes/index.js';
import { MS_PER_SECOND, reviewStateToEventType } from './utils/index.js';
import type { Config } from './config.js';
import { EventType, IntervalService, PrState, TYPES } from './domain.js';

import type { Logger } from '@couimet/logger-contract';
import type { PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';

@injectable()
export class ReviewDetector extends IntervalService {
  /* c8 ignore start */
  constructor(
    @inject(TYPES.QueueRepository) private readonly queue: QueueRepository,
    @inject(TYPES.PullRequestRepository) private readonly pullRequests: PullRequestRepository,
    @inject(TYPES.CoderabbitGitHubClient) private readonly github: CoderabbitGitHubClient,
    @inject(TYPES.ProbeFactory) private readonly probeFactory: ProbeFactory,
    @inject(TYPES.PrismaClient) private readonly prisma: PrismaClient,
    @inject(TYPES.Config) cfg: Config,
    @inject(TYPES.Logger) log: Logger,
  ) {
    super(log, cfg.POLL_INTERVAL_SEC * MS_PER_SECOND);
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
    const { pr_state: prStateMap } = await this.pullRequests.getColumnMaps(prIds, ['pr_state']);
    for (const item of retriggeredItems) {
      probe.withItem(item);
      try {
        if (item.retriggered_at == null) continue;

        const prState = prStateMap.get(item.pull_request_id);
        if (prState === PrState.merged || prState === PrState.closed) {
          await this.prisma.$transaction(async (tx) => {
            await this.queue.markReviewed(item.id, tx);
          });
          probe.prClosedResolved(prState);
          continue;
        }

        const { owner, repo } = splitRepo(item.repo_full_name);

        // Try Reviews API first for structured state, fall back to body-matched completed review
        const review = await this.github.findLatestCoderabbitReview(owner, repo, item.pr_number, item.retriggered_at);
        const completedReview = review === undefined ? await this.github.findCompletedReview(owner, repo, item.pr_number, item.retriggered_at) : undefined;

        if (!review && !completedReview) {
          probe.noCompletedReviewFound();
          continue;
        }

        const eventType = review
          ? reviewStateToEventType(review.state)
          : completedReview!.isApproval
            ? EventType.coderabbit_review_approved
            : EventType.coderabbit_review_changes_suggested;
        const commentUrl = review ? review.htmlUrl : completedReview!.htmlUrl;

        await this.prisma.$transaction(async (tx) => {
          await this.queue.markReviewed(item.id, tx);
          await probe.reviewed(eventType, commentUrl, tx);
        });
      } catch (err: unknown) {
        probe.caughtError(err);
      }
    }
  }
}
