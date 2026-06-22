import { jest } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';

export interface MockReviewQueueDelegate {
  create: jest.Mock<any>;
  findFirst: jest.Mock<any>;
  update: jest.Mock<any>;
  findMany: jest.Mock<any>;
  count: jest.Mock<any>;
  groupBy: jest.Mock<any>;
}

export interface MockEventDelegate {
  create: jest.Mock<any>;
  findMany: jest.Mock<any>;
  count: jest.Mock<any>;
  groupBy: jest.Mock<any>;
}

export interface MockPrismaOptions {
  reviewQueue?: Partial<MockReviewQueueDelegate>;
  event?: Partial<MockEventDelegate>;
}

export interface MockPrismaResult {
  prisma: PrismaClient;
  reviewQueue: MockReviewQueueDelegate;
  event: MockEventDelegate;
}

export const createMockPrismaClient = (options?: MockPrismaOptions): MockPrismaResult => {
  const reviewQueue: MockReviewQueueDelegate = {
    create: jest.fn<any>(),
    findFirst: jest.fn<any>(),
    update: jest.fn<any>(),
    findMany: jest.fn<any>(),
    count: jest.fn<any>(),
    groupBy: jest.fn<any>(),
    ...options?.reviewQueue,
  };
  const event: MockEventDelegate = {
    create: jest.fn<any>(),
    findMany: jest.fn<any>(),
    count: jest.fn<any>(),
    groupBy: jest.fn<any>(),
    ...options?.event,
  };

  return {
    prisma: { reviewQueue, event } as unknown as PrismaClient,
    reviewQueue,
    event,
  };
};
