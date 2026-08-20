import type { QueueRepository } from '../../src/db/index.js';

import { jest } from '@jest/globals';

export const createMockQueueRepo = (overrides?: Partial<jest.Mocked<QueueRepository>>): jest.Mocked<QueueRepository> =>
  ({
    enqueue: jest.fn<any>(),
    markRetriggered: jest.fn<any>(),
    markRetriggerSkipped: jest.fn<any>().mockResolvedValue(true),
    markResolved: jest.fn<any>(),
    markResolvedByUuid: jest.fn<any>().mockResolvedValue(undefined),
    reschedule: jest.fn<any>(),
    backoff: jest.fn<any>(),
    findBySourceCommentId: jest.fn<any>().mockResolvedValue(null),
    resolveStaleRetriggered: jest.fn<any>().mockResolvedValue(0),
    getActiveQueue: jest.fn<any>().mockResolvedValue([]),
    getPendingQueue: jest.fn<any>().mockResolvedValue([]),
    getRetriggeredQueue: jest.fn<any>().mockResolvedValue([]),
    getActivityList: jest.fn<any>().mockResolvedValue({ items: [], total: 0 }),
    getOldestPending: jest.fn<any>().mockResolvedValue(null),
    getAll: jest.fn<any>().mockResolvedValue({ items: [], total: 0 }),
    getCountsByStatus: jest.fn<any>().mockResolvedValue({ pending: 0, retriggered: 0, resolved: 0 }),
    getSkippedItems: jest.fn<any>().mockResolvedValue([]),
    incrementAttempts: jest.fn<any>(),
    ...overrides,
  }) as unknown as jest.Mocked<QueueRepository>;
