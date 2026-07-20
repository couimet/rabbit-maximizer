import type { CoderabbitCommentRepository } from './db/coderabbitCommentRepository.js';
import type { PullRequestRepository } from './db/pullRequestRepository.js';
import type { QueueRepository } from './db/queueRepository.js';
import { CommentEditDetector } from './detection/CommentEditDetector.js';
import type { CoderabbitGitHubClient } from './github/coderabbitGitHubClient.js';
import { splitRepo } from './github/splitRepo.js';
import type { ProbeFactory } from './probes/ProbeFactory.js';
import { CodeRabbitCommentType } from './types/CodeRabbitCommentType.js';
import type { EditDetectionResult } from './types/EditDetectionResult.js';
import { type QueueItem } from './types/index.js';
import { codeRabbitCommentTypeToEventType } from './utils/codeRabbitCommentTypeToEventType.js';
import { MS_PER_SECOND } from './utils/durations.js';
import type { Config } from './config.js';
import { IntervalService } from './IntervalService.js';
import { TYPES } from './inversify-types.js';

import type { Logger } from '@couimet/logger-contract';
import type { PrismaClient } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { inject, injectable } from 'inversify';

const COMPLETED_REVIEW_TYPES: readonly string[] = [CodeRabbitCommentType.review_approved, CodeRabbitCommentType.review_changes_suggested];

@injectable()
export class ReviewDetector extends IntervalService {
  /* c8 ignore start */
  constructor(
    @inject(TYPES.QueueRepository) private readonly queue: QueueRepository,
    @inject(TYPES.PullRequestRepository) private readonly pullRequests: PullRequestRepository,
    @inject(TYPES.CoderabbitGitHubClient) private readonly github: CoderabbitGitHubClient,
    @inject(TYPES.ProbeFactory) private readonly probeFactory: ProbeFactory,
    @inject(TYPES.CommentEditDetector) private readonly commentEditDetector: CommentEditDetector,
    @inject(TYPES.CoderabbitCommentRepository) private readonly commentRepo: CoderabbitCommentRepository,
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
    for (const item of retriggeredItems) {
      probe.withItem(item);
      try {
        if (item.retriggered_at == null) continue;
        const { owner, repo } = splitRepo(item.repo_full_name);

        const editResult = await this.tryEditDetection(owner, repo, item, probe);

        if (editResult !== undefined && editResult.wasEdited && COMPLETED_REVIEW_TYPES.includes(editResult.newClassification)) {
          await this.markItemReviewed(item, editResult.updatedCommentRow.url, editResult.newClassification, probe);
          continue;
        }

        const completedReview = await this.github.findCompletedReview(owner, repo, item.pr_number, item.retriggered_at);

        if (!completedReview) {
          probe.noCompletedReviewFound();
          continue;
        }

        const classification = completedReview.isApproval ? CodeRabbitCommentType.review_approved : CodeRabbitCommentType.review_changes_suggested;

        await this.markItemReviewed(item, completedReview.htmlUrl, classification, probe);
      } catch (err: unknown) {
        probe.caughtError(err);
      }
    }
  }

  private async markItemReviewed(
    item: QueueItem,
    url: string,
    classification: CodeRabbitCommentType,
    probe: ReturnType<ProbeFactory['createReviewDetectorProbe']>,
  ): Promise<void> {
    const eventType = codeRabbitCommentTypeToEventType(classification);

    await this.prisma.$transaction(async (tx) => {
      await this.queue.markReviewed(item.id, tx);
      await this.pullRequests.updateLastCoderabbitReviewResult(item.pull_request_id, url, classification, tx);
      await probe.reviewed(eventType, url, tx);
    });
  }

  private async tryEditDetection(
    owner: string,
    repo: string,
    item: QueueItem,
    probe: ReturnType<ProbeFactory['createReviewDetectorProbe']>,
  ): Promise<EditDetectionResult | undefined> {
    try {
      const result = await this.commentEditDetector.detect(owner, repo, item);
      if (result === undefined) {
        probe.commentNotEdited();
        return undefined;
      }
      if (!result.wasEdited) {
        probe.commentNotEdited();
      }
      return result;
    } catch (err: unknown) {
      const error = err as { status?: number };
      if (error.status === StatusCodes.NOT_FOUND || error.status === StatusCodes.GONE) {
        probe.commentDeleted();
        await this.commentRepo.deactivate(item.source_comment_id);
        return undefined;
      }
      throw err;
    }
  }
}
