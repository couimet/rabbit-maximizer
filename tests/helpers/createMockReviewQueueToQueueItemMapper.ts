import type { ReviewQueueToQueueItemMapper } from '../../src/mappers/index.js';
import type { QueueItem } from '../../src/types/index.js';

import { jest } from '@jest/globals';
import type { ReviewQueue } from '@prisma/client';

// The row stands in for the mapped item, so a call returns the same value for the same row.
export const createMockReviewQueueToQueueItemMapper = (
  overrides?: Partial<jest.Mocked<ReviewQueueToQueueItemMapper>>,
): jest.Mocked<ReviewQueueToQueueItemMapper> =>
  ({
    fromReviewQueue: jest.fn<any>().mockImplementation((row: ReviewQueue) => row as unknown as QueueItem),
    ...overrides,
  }) as unknown as jest.Mocked<ReviewQueueToQueueItemMapper>;
