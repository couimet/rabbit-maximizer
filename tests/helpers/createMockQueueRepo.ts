import type { QueueRepository } from '../../src/db/queueRepository.js';

import { jest } from '@jest/globals';

export const createMockQueueRepo = (overrides: Partial<QueueRepository> = {}): QueueRepository => ({
  enqueue: jest.fn<any>(),
  markPosted: jest.fn<any>(),
  markCompleted: jest.fn<any>(),
  reschedule: jest.fn<any>(),
  markFailed: jest.fn<any>(),
  getPendingQueue: jest.fn<any>().mockResolvedValue([]),
  getPostedQueue: jest.fn<any>().mockResolvedValue([]),
  getOldestPending: jest.fn<any>().mockResolvedValue(null),
  getAll: jest.fn<any>().mockResolvedValue({ items: [], total: 0 }),
  getCountsByStatus: jest.fn<any>().mockResolvedValue({ pending: 0, posted: 0, completed: 0, failed: 0 }),
  ...overrides,
});
