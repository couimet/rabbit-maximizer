import type { CreateSkippedData } from './index.js';

export interface EnqueueData extends CreateSkippedData {
  readonly commentUpdatedAt?: Date;
  /** When provided, blocks re-enqueue of a resolved item with the same source_comment_id while Date.now() `<` cooldownUntil. Computed from the comment's updated_at + parseWaitSeconds(body). */
  readonly cooldownUntil?: Date;
}
