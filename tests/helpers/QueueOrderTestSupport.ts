import { generateReviewQueueHydrationData } from './ReviewQueueTestSupport.js';

import { getUniqueDate, getUniqueInt } from '@couimet/dynamic-testing';
import type { ReviewQueue } from '@prisma/client';

export interface ReviewQueueWithOrder extends ReviewQueue {
  readonly queueOrder: {
    readonly id: number;
    readonly queue_item_id: number;
    readonly position: number | null;
    readonly created_at: Date;
    readonly updated_at: Date;
  };
}

export const generateReviewQueueWithOrderHydrationData = (
  reviewQueueOverrides?: Partial<ReviewQueue>,
  queueOrderOverrides?: { id?: number; position?: number | null },
): ReviewQueueWithOrder => {
  const base = generateReviewQueueHydrationData(reviewQueueOverrides);
  return {
    ...base,
    queueOrder: {
      id: queueOrderOverrides?.id ?? getUniqueInt(),
      queue_item_id: base.id,
      position: queueOrderOverrides?.position ?? null,
      created_at: getUniqueDate(),
      updated_at: getUniqueDate(),
    },
  };
};
