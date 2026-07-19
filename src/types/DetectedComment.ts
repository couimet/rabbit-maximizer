import type { CodeRabbitCommentType } from './CodeRabbitCommentType.js';
import type { ReviewLimitComment } from './ReviewLimitComment.js';

/** A ReviewLimitComment enriched with the PR title from the GitHub search API. */
export interface DetectedComment extends ReviewLimitComment {
  readonly pr_title: string;
  readonly comment_type?: CodeRabbitCommentType;
}
