import { ActivityState } from '../../src/domain.js';
import { type ActivityStatus, type QueueItemResponse } from '../../src/types/index.js';
import { deriveActivityStatus } from '../../src/utils/index.js';

const FALLBACK: ActivityStatus = { state: ActivityState.pending, linkUrl: undefined };

export const safeDeriveActivityStatus = (item: QueueItemResponse): ActivityStatus => {
  try {
    return deriveActivityStatus(item);
  } catch {
    return FALLBACK;
  }
};
