import type { QueueOrderRepository } from '../../src/db/queueOrderRepository.js';
import type { QueueItem, QueueStatus } from '../../src/types/index.js';

import { jest } from '@jest/globals';

const makeItem = (id: number): QueueItem => ({
  id,
  uuid: `uuid-${id}`,
  repo_full_name: 'owner/repo',
  pr_number: id,
  status: 'pending' as QueueStatus,
  not_before: new Date(),
  attempts: 0,
  created_at: new Date(),
  updated_at: new Date(),
});

export const createMockQueueOrderRepo = (overrides: Partial<QueueOrderRepository> = {}): QueueOrderRepository => ({
  getEffectiveOrder: jest.fn<any>().mockResolvedValue([]),
  moveItems: jest.fn<any>().mockResolvedValue([]),
  moveToTop: jest.fn<any>().mockResolvedValue(makeItem(1)),
  ...overrides,
});
