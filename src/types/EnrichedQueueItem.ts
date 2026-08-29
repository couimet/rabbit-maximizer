import type { PrState } from '../domain.js';

import type { CoderabbitReviewVerdict } from './CoderabbitReviewVerdict.js';
import type { QueueItem } from './QueueItem.js';

export interface EnrichedQueueItem extends QueueItem {
  readonly prState: PrState | undefined;
  readonly lastCoderabbitAcknowledgedAt: Date | undefined;
  readonly authorLogin: string;
  readonly coderabbitReview?: CoderabbitReviewVerdict;
  readonly retriggerCount: number;
  readonly reviewCount: number;
}
