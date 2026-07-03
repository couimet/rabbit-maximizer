import type { EventRepository } from '../../src/db/eventRepository.js';

import { jest } from '@jest/globals';

export const createMockEventRepo = (overrides: Partial<EventRepository> = {}): EventRepository => ({
  record: jest.fn<any>(),
  listForPr: jest.fn<any>(),
  countByType: jest.fn<any>().mockResolvedValue({ detected: 0, enqueued: 0, posted: 0, bypassed: 0, completed: 0, failed: 0 }),
  listRecent: jest.fn<any>().mockResolvedValue({ items: [], total: 0 }),
  ...overrides,
});
