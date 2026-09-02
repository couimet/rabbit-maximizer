import type { CodeRabbitCommentType } from '../CodeRabbitCommentType.js';

import type { CreateSkippedData } from './index.js';

export interface EnqueueData extends CreateSkippedData {
  /** CodeRabbit's per-comment Run ID extracted from the comment body at detection time. Drives same-comment adoption: a new run on a still-retriggered comment updates the item's run tracking in place. */
  readonly coderabbitRunId: string | undefined;
  readonly commentUpdatedAt?: Date;
  /** When provided, blocks re-enqueue of a resolved item with the same source_comment_id while Date.now() `<` cooldownUntil. Computed from the comment's updated_at + parseWaitSeconds(body). */
  readonly cooldownUntil?: Date;
  /** Source comment classification at detection time. Scopes commit-primary review acceptance and stale-reopen behavior to the review_skipped flow. */
  readonly sourceCommentType: CodeRabbitCommentType | undefined;
}
