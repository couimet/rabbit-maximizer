import { jest } from '@jest/globals';

export const createMockQueueRepo = (over: { getCountsByStatus?: jest.Mock<any>; getPendingQueue?: jest.Mock<any>; getAll?: jest.Mock<any> } = {}) => ({
  enqueue: jest.fn<any>(),
  getNextDue: jest.fn<any>(),
  markPosted: jest.fn<any>(),
  markCompleted: jest.fn<any>(),
  reschedule: jest.fn<any>(),
  markFailed: jest.fn<any>(),
  getPendingQueue: over.getPendingQueue ?? jest.fn<any>().mockResolvedValue([]),
  getAll: over.getAll ?? jest.fn<any>().mockResolvedValue({ items: [], total: 0 }),
  getCountsByStatus: over.getCountsByStatus ?? jest.fn<any>().mockResolvedValue({ pending: 0, posted: 0, completed: 0, failed: 0 }),
});
