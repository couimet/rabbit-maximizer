import type { CoderabbitCommentRepository } from '../db/coderabbitCommentRepository.js';
import { classifyCoderabbitComment } from '../github/classifyCoderabbitComment.js';
import type { CoderabbitGitHubClient } from '../github/coderabbitGitHubClient.js';
import { TYPES } from '../inversify-types.js';
import type { EditDetectionResult } from '../types/EditDetectionResult.js';
import type { QueueItem } from '../types/QueueItem.js';

import type { Prisma } from '@prisma/client';
import { inject, injectable } from 'inversify';

@injectable()
export class CommentEditDetector {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.CoderabbitCommentRepository) private readonly commentRepo: CoderabbitCommentRepository,
    @inject(TYPES.CoderabbitGitHubClient) private readonly github: CoderabbitGitHubClient,
  ) {}
  /* c8 ignore stop */

  async detect(owner: string, repo: string, item: QueueItem, tx?: Prisma.TransactionClient): Promise<EditDetectionResult | undefined> {
    const existing = await this.commentRepo.findByCommentId(item.source_comment_id, tx);
    if (existing === undefined) {
      return undefined;
    }

    const result = await this.github.fetchComment(owner, repo, item.source_comment_id);
    const ghUpdatedAt = new Date(result.updatedAt);

    if (ghUpdatedAt.getTime() <= existing.gh_updated_at.getTime()) {
      return { wasEdited: false, newClassification: existing.comment_type, updatedCommentRow: existing };
    }

    const newClassification = classifyCoderabbitComment(result.body);
    const updatedCommentRow = await this.commentRepo.upsert(
      {
        comment_id: item.source_comment_id,
        pull_request_id: item.pull_request_id,
        url: existing.url,
        comment_type: newClassification,
        body: result.body,
        gh_created_at: existing.gh_created_at,
        gh_updated_at: ghUpdatedAt,
      },
      tx,
    );

    return { wasEdited: true, newClassification, updatedCommentRow };
  }
}
