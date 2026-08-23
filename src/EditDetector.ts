import type { CoderabbitCommentRepository } from './db/index.js';
import { RabbitMaximizerError, RabbitMaximizerErrorCodes } from './errors/index.js';
import { classifyCoderabbitComment, type CoderabbitGitHubClient, splitRepo } from './github/index.js';
import { type EditDetectionOutcome, type QueueItem } from './types/index.js';
import { extractCoderabbitRunId, isReviewVerdictState } from './utils/index.js';
import { CodeRabbitCommentType, FallbackReason, TYPES } from './domain.js';
import { RabbitResult } from './RabbitResult.js';

import { inject, injectable } from 'inversify';

export interface EditDetector {
  detectEdit(item: QueueItem): Promise<RabbitResult<EditDetectionOutcome>>;
}

@injectable()
export class EditDetectorImpl implements EditDetector {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.CoderabbitCommentRepository)
    private readonly coderabbitComments: CoderabbitCommentRepository,
    @inject(TYPES.CoderabbitGitHubClient)
    private readonly github: CoderabbitGitHubClient,
  ) {}
  /* c8 ignore stop */

  async detectEdit(item: QueueItem): Promise<RabbitResult<EditDetectionOutcome>> {
    try {
      const matchingComment = await this.coderabbitComments.findByCommentId(item.pull_request_id, item.source_comment_id);

      if (matchingComment == null) {
        return RabbitResult.ok({ action: 'fallback', reason: FallbackReason.NotFound });
      }

      const { owner, repo } = splitRepo(item.repo_full_name);
      const fetchResult = await this.github.fetchComment(owner, repo, item.source_comment_id);

      const freshGhUpdatedAt = new Date(fetchResult.updatedAt);
      if (freshGhUpdatedAt <= matchingComment.last_seen_at) {
        return RabbitResult.ok({ action: 'fallback', reason: FallbackReason.NotEdited });
      }

      const { classification: newType } = classifyCoderabbitComment(fetchResult.body);

      const updatedComment = {
        comment_id: item.source_comment_id,
        pull_request_id: item.pull_request_id,
        url: matchingComment.url,
        comment_type: newType,
        body: fetchResult.body,
        gh_created_at: matchingComment.gh_created_at,
        gh_updated_at: freshGhUpdatedAt,
        coderabbit_run_id: extractCoderabbitRunId(fetchResult.body) ?? null,
      };

      await this.coderabbitComments.upsert(updatedComment);

      if (isReviewVerdictState(newType)) {
        return RabbitResult.ok({
          action: 'resolved',
          reviewUrl: matchingComment.url,
          verdictState: newType,
        });
      }

      if (newType === CodeRabbitCommentType.review_skipped) {
        return RabbitResult.ok({ action: 'skipped', reviewUrl: matchingComment.url });
      }

      return RabbitResult.ok({ action: 'fallback', reason: FallbackReason.NotAReview });
    } catch (err: unknown) {
      return RabbitResult.err(
        new RabbitMaximizerError({
          code: RabbitMaximizerErrorCodes.EDIT_DETECTION_FAILED,
          message: 'Edit detection failed',
          functionName: 'EditDetectorImpl.detectEdit',
          details: { queueItemId: item.id, sourceCommentId: item.source_comment_id, error: err },
        }),
      );
    }
  }
}
