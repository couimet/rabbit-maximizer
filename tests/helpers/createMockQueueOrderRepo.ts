import type { QueueOrderRepository } from '../../src/db/queueOrderRepository.js';

import { jest } from '@jest/globals';

export const createMockQueueOrderRepo = (overrides: Partial<QueueOrderRepository> = {}): QueueOrderRepository => ({
  getEffectiveOrder: jest.fn<any>().mockResolvedValue([]),
  moveItems: jest.fn<any>().mockResolvedValue([]),
  ...overrides,
});
