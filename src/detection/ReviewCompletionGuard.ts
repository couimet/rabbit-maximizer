import type { CoderabbitCommentRepository } from '../db/coderabbitCommentRepository.js';
import { TYPES } from '../inversify-types.js';
import { CodeRabbitCommentType } from '../types/CodeRabbitCommentType.js';

import type { Prisma } from '@prisma/client';
import { inject, injectable } from 'inversify';

@injectable()
export class ReviewCompletionGuard {
  /* c8 ignore start — decorator emit branches */
  constructor(@inject(TYPES.CoderabbitCommentRepository) private readonly commentRepo: CoderabbitCommentRepository) {}
  /* c8 ignore stop */

  async hasCompletedReview(pullRequestId: number, tx?: Prisma.TransactionClient): Promise<boolean> {
    const approved = await this.commentRepo.findActiveByType(pullRequestId, CodeRabbitCommentType.review_approved, tx);
    if (approved) return true;
    const changesSuggested = await this.commentRepo.findActiveByType(pullRequestId, CodeRabbitCommentType.review_changes_suggested, tx);
    return changesSuggested !== undefined;
  }
}
