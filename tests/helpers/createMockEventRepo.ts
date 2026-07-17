import type { EventRepository } from '../../src/db/eventRepository.js';

import { jest } from '@jest/globals';

export const createMockEventRepo = (overrides?: Partial<jest.Mocked<EventRepository>>): jest.Mocked<EventRepository> =>
  ({
    record: jest.fn<any>(),
    listForPr: jest.fn<any>(),
    countByType: jest.fn<any>().mockResolvedValue({
      detected: 0,
      enqueued: 0,
      retriggered: 0,
      bypassed: 0,
      failed: 0,
      coderabbit_review_approved: 0,
      coderabbit_review_changes_suggested: 0,
    }),
    listRecent: jest.fn<any>().mockResolvedValue({ items: [], total: 0 }),
    ...overrides,
  }) as unknown as jest.Mocked<EventRepository>;
