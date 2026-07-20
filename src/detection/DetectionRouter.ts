import type { Config } from '../config.js';
import type { CoderabbitCommentRepository } from '../db/coderabbitCommentRepository.js';
import type { PullRequestRepository } from '../db/pullRequestRepository.js';
import type { QueueRepository } from '../db/queueRepository.js';
import { RabbitMaximizerError } from '../errors/RabbitMaximizerError.js';
import { classifyCoderabbitComment } from '../github/classifyCoderabbitComment.js';
import { hasOwnRetriggerMarker } from '../github/hasOwnRetriggerMarker.js';
import { parseWaitSeconds } from '../github/parseWaitSeconds.js';
import { TYPES } from '../inversify-types.js';
import { CodeRabbitCommentType } from '../types/CodeRabbitCommentType.js';
import type { DetectedComment } from '../types/DetectedComment.js';
import type { OnDetectedCallback } from '../types/OnDetectedCallback.js';
import { codeRabbitCommentTypeToEventType } from '../utils/codeRabbitCommentTypeToEventType.js';
import { MS_PER_SECOND } from '../utils/durations.js';

import { evaluateReEnqueue } from './ReEnqueueEvaluator.js';
import { ReviewCompletionGuard } from './ReviewCompletionGuard.js';

import type { Logger } from '@couimet/logger-contract';
import type { PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';

export interface DetectionRouter {
  route(comment: DetectedComment): Promise<Date | undefined>;
}

@injectable()
export class DetectionRouterImpl implements DetectionRouter {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.ReviewCompletionGuard) private readonly completionGuard: ReviewCompletionGuard,
    @inject(TYPES.QueueRepository) private readonly queue: QueueRepository,
    @inject(TYPES.PullRequestRepository) private readonly pullRequests: PullRequestRepository,
    @inject(TYPES.CoderabbitCommentRepository) private readonly commentRepo: CoderabbitCommentRepository,
    @inject(TYPES.PrismaClient) private readonly prisma: PrismaClient,
    @inject(TYPES.OnDetectedCallback) private readonly onDetected: OnDetectedCallback,
    @inject(TYPES.Config) private readonly config: Config,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  // eslint-disable-next-line require-await
  async route(comment: DetectedComment): Promise<Date | undefined> {
    const classification = classifyCoderabbitComment(comment.body);

    switch (classification) {
      case CodeRabbitCommentType.unknown:
        return this.handleUnknown(comment);
      case CodeRabbitCommentType.review_limited:
        return this.handleReviewLimited(comment);
      case CodeRabbitCommentType.review_skipped:
        return this.handleReviewSkipped(comment);
      case CodeRabbitCommentType.review_approved:
      case CodeRabbitCommentType.review_changes_suggested:
        return this.handleCompletedReview(comment, classification);
      /* c8 ignore next 3 — unreachable: classifyCoderabbitComment always returns a valid CodeRabbitCommentType member */
      default:
        throw RabbitMaximizerError.forUnexpectedSwitchDefault('CodeRabbit comment type', classification, 'DetectionRouter.route');
    }
  }

  private handleUnknown(comment: DetectedComment): undefined {
    this.log.debug(
      { fn: 'DetectionRouter.handleUnknown', repo: comment.repoFullName, pr: comment.prNumber, commentId: comment.commentId },
      'Skipping unclassified comment',
    );
    return undefined;
  }

  private async handleReviewLimited(comment: DetectedComment): Promise<Date | undefined> {
    if (hasOwnRetriggerMarker(comment.body)) {
      this.log.debug(
        { fn: 'DetectionRouter.handleReviewLimited', repo: comment.repoFullName, pr: comment.prNumber, commentId: comment.commentId },
        'Skipping comment with own retrigger marker',
      );
      return undefined;
    }

    const existingItem = await this.queue.findBySourceCommentId(comment.commentId);
    const decision = evaluateReEnqueue(existingItem);

    if (decision.action === 'skip') {
      this.log.debug(
        { fn: 'DetectionRouter.handleReviewLimited', repo: comment.repoFullName, pr: comment.prNumber, commentId: comment.commentId, reason: decision.reason },
        'Skipping comment per ReEnqueueEvaluator',
      );
      return undefined;
    }

    if (decision.action === 're_enqueue') {
      const pullRequestRow = await this.pullRequests.findByRepoAndPr(comment.repoFullName, comment.prNumber);
      if (pullRequestRow) {
        const alreadyReviewed = await this.completionGuard.hasCompletedReview(pullRequestRow.id);
        if (alreadyReviewed) {
          this.log.debug(
            { fn: 'DetectionRouter.handleReviewLimited', repo: comment.repoFullName, pr: comment.prNumber, commentId: comment.commentId },
            'Review already detected; skipping re-enqueue',
          );
          return undefined;
        }
      }
    }

    const waitSeconds = parseWaitSeconds(comment.body);
    const effectiveWait = waitSeconds ?? this.config.REVIEW_LIMIT_FALLBACK_WAIT_SEC;
    const candidate = new Date(new Date(comment.updatedAt).getTime() + effectiveWait * MS_PER_SECOND);

    await this.upsertComment(comment);
    await this.onDetected(comment, effectiveWait);

    return candidate;
  }

  private async handleReviewSkipped(comment: DetectedComment): Promise<undefined> {
    await this.upsertComment(comment);
    await this.onDetected(comment, this.config.REVIEW_LIMIT_FALLBACK_WAIT_SEC);
    return undefined;
  }

  private async handleCompletedReview(comment: DetectedComment, classification: CodeRabbitCommentType): Promise<undefined> {
    const existingItem = await this.queue.findBySourceCommentId(comment.commentId);
    if (!existingItem) {
      this.log.debug(
        { fn: 'DetectionRouter.handleCompletedReview', repo: comment.repoFullName, pr: comment.prNumber, commentId: comment.commentId },
        'No queue item found for completed review comment',
      );
      return undefined;
    }

    const eventType = codeRabbitCommentTypeToEventType(classification);

    await this.prisma.$transaction(async (tx) => {
      await this.queue.markReviewed(existingItem.id, tx);
      await this.pullRequests.updateLastCoderabbitReviewResult(existingItem.pull_request_id, comment.url, classification, tx);
      await this.upsertComment(comment);
    });

    this.log.info(
      { fn: 'DetectionRouter.handleCompletedReview', repo: comment.repoFullName, pr: comment.prNumber, queueId: existingItem.id, eventType },
      'Completed review detected via polling',
    );
    return undefined;
  }

  private async upsertComment(comment: DetectedComment): Promise<void> {
    const pullRequestRow = await this.pullRequests.findByRepoAndPr(comment.repoFullName, comment.prNumber);
    if (pullRequestRow === null) {
      return;
    }
    await this.commentRepo.upsert({
      comment_id: comment.commentId,
      pull_request_id: pullRequestRow.id,
      url: comment.url,
      comment_type: comment.commentType,
      body: comment.body,
      gh_created_at: new Date(comment.createdAt),
      gh_updated_at: new Date(comment.updatedAt),
    });
  }
}
