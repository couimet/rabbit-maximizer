import { ActivityState } from '../../src/domain.js';
import { type ActivityListItemResponse, type ActivityStatus, type QueueItemResponse } from '../../src/types/index.js';
import { deriveActivityStatus } from '../../src/utils/index.js';

type DeriveStatusInput = QueueItemResponse | ActivityListItemResponse;

const FALLBACK: ActivityStatus = { state: ActivityState.pending, linkUrl: undefined };

export const safeDeriveActivityStatus = (item: DeriveStatusInput): ActivityStatus => {
  try {
    return deriveActivityStatus(item);
  } catch {
    return FALLBACK;
  }
};
