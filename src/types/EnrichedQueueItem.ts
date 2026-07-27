import type { PrState } from '../domain.js';

import type { CoderabbitReviewVerdict } from './CoderabbitReviewVerdict.js';
import type { QueueItem } from './QueueItem.js';

export interface EnrichedQueueItem extends QueueItem {
  readonly prState: PrState | undefined;
  readonly lastCoderabbitAcknowledgedAt: Date | undefined;
  readonly authorLogin: string;
  // TODO[2026-08-10]: #160 — populate via QueueItemEnricher once PullRequestRepository.getColumnMaps() exposes review state columns
  readonly coderabbitReview?: CoderabbitReviewVerdict;
}
