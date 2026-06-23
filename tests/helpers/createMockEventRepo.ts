import { jest } from '@jest/globals';

export const createMockEventRepo = (over: { countByType?: jest.Mock<any>; listRecent?: jest.Mock<any> } = {}) => ({
  record: jest.fn<any>(),
  listForPr: jest.fn<any>(),
  countByType: over.countByType ?? jest.fn<any>().mockResolvedValue({ detected: 0, enqueued: 0, posted: 0, rejected: 0, completed: 0, failed: 0 }),
  listRecent: over.listRecent ?? jest.fn<any>().mockResolvedValue({ items: [], total: 0 }),
});
