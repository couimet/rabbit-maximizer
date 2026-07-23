import type { QueueOrderRepository } from '../../src/db/index.js';
import { type QueueItem } from '../../src/types/index.js';

import { generateQueueItemHydrationData } from './index.js';

import { jest } from '@jest/globals';

export const createMockQueueOrderRepo = (overrides?: Partial<jest.Mocked<QueueOrderRepository>>): jest.Mocked<QueueOrderRepository> =>
  ({
    getEffectiveOrder: jest.fn<any>().mockResolvedValue([]),
    moveItems: jest.fn<any>().mockResolvedValue([]),
    moveToTop: jest.fn<any>().mockResolvedValue(generateQueueItemHydrationData() as QueueItem),
    ...overrides,
  }) as unknown as jest.Mocked<QueueOrderRepository>;
