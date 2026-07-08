import type { QueueRepository } from '../../src/db/queueRepository.js';

import { jest } from '@jest/globals';

export const createMockQueueRepo = (overrides?: Partial<jest.Mocked<QueueRepository>>): jest.Mocked<QueueRepository> =>
  ({
    enqueue: jest.fn<any>(),
    markRetriggered: jest.fn<any>(),
    markCompleted: jest.fn<any>(),
    reschedule: jest.fn<any>(),
    backoff: jest.fn<any>(),
    markFailed: jest.fn<any>(),
    getPendingQueue: jest.fn<any>().mockResolvedValue([]),
    getRetriggeredQueue: jest.fn<any>().mockResolvedValue([]),
    getTriggered: jest.fn<any>().mockResolvedValue({ items: [], total: 0 }),
    getOldestPending: jest.fn<any>().mockResolvedValue(null),
    getAll: jest.fn<any>().mockResolvedValue({ items: [], total: 0 }),
    getCountsByStatus: jest.fn<any>().mockResolvedValue({ pending: 0, retriggered: 0, completed: 0, failed: 0 }),
    ...overrides,
  }) as unknown as jest.Mocked<QueueRepository>;
