import type { CodeRabbitCommentType } from '../domain.js';

import type { ReviewLimitComment } from './index.js';

/** A ReviewLimitComment enriched with the PR title from the GitHub search API and the full comment body. */
export interface DetectedComment extends ReviewLimitComment {
  readonly prTitle: string;
  readonly body: string;
  readonly commentType: CodeRabbitCommentType;
}
