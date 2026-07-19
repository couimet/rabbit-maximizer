import type { QueueOrderRepository } from '../../src/db/queueOrderRepository.js';
import { type QueueItem } from '../../src/types/index.js';

import { makeQueueItem } from './makeQueueItem.js';

import { jest } from '@jest/globals';

export const createMockQueueOrderRepo = (overrides?: Partial<jest.Mocked<QueueOrderRepository>>): jest.Mocked<QueueOrderRepository> =>
  ({
    getEffectiveOrder: jest.fn<any>().mockResolvedValue([]),
    moveItems: jest.fn<any>().mockResolvedValue([]),
    moveToTop: jest.fn<any>().mockResolvedValue(makeQueueItem() as QueueItem),
    ...overrides,
  }) as unknown as jest.Mocked<QueueOrderRepository>;
