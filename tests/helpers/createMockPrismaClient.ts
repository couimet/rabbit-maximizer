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

export interface MockQueueOrderDelegate {
  create: jest.Mock<any>;
  findMany: jest.Mock<any>;
  findFirst: jest.Mock<any>;
  update: jest.Mock<any>;
  updateMany: jest.Mock<any>;
  findUnique: jest.Mock<any>;
  upsert: jest.Mock<any>;
  delete: jest.Mock<any>;
  deleteMany: jest.Mock<any>;
  count: jest.Mock<any>;
  groupBy: jest.Mock<any>;
  aggregate: jest.Mock<any>;
}

export interface MockSystemStateDelegate {
  findUnique: jest.Mock<any>;
  upsert: jest.Mock<any>;
  findFirst: jest.Mock<any>;
  findMany: jest.Mock<any>;
  create: jest.Mock<any>;
  update: jest.Mock<any>;
  delete: jest.Mock<any>;
}

export interface MockPrismaOptions {
  reviewQueue?: Partial<MockReviewQueueDelegate>;
  event?: Partial<MockEventDelegate>;
  queueOrder?: Partial<MockQueueOrderDelegate>;
  systemState?: Partial<MockSystemStateDelegate>;
  $executeRawUnsafe?: jest.Mock<any>;
  $executeRaw?: jest.Mock<any>;
  $transaction?: jest.Mock<any>;
}

export interface MockPrismaResult {
  prisma: PrismaClient;
  reviewQueue: MockReviewQueueDelegate;
  event: MockEventDelegate;
  queueOrder: MockQueueOrderDelegate;
  systemState: MockSystemStateDelegate;
}

export const createMockPrismaClient = (overrides: MockPrismaOptions = {}): MockPrismaResult => {
  const reviewQueue: MockReviewQueueDelegate = {
    create: jest.fn<any>(),
    findFirst: jest.fn<any>(),
    update: jest.fn<any>(),
    findMany: jest.fn<any>(),
    count: jest.fn<any>(),
    groupBy: jest.fn<any>(),
    ...overrides.reviewQueue,
  };
  const event: MockEventDelegate = {
    create: jest.fn<any>(),
    findMany: jest.fn<any>(),
    count: jest.fn<any>(),
    groupBy: jest.fn<any>(),
    ...overrides.event,
  };
  const queueOrder: MockQueueOrderDelegate = {
    create: jest.fn<any>(),
    findMany: jest.fn<any>(),
    findFirst: jest.fn<any>(),
    update: jest.fn<any>(),
    updateMany: jest.fn<any>(),
    findUnique: jest.fn<any>(),
    upsert: jest.fn<any>(),
    delete: jest.fn<any>(),
    deleteMany: jest.fn<any>(),
    count: jest.fn<any>(),
    groupBy: jest.fn<any>(),
    aggregate: jest.fn<any>(),
    ...overrides.queueOrder,
  };
  const systemState: MockSystemStateDelegate = {
    findUnique: jest.fn<any>(),
    upsert: jest.fn<any>(),
    findFirst: jest.fn<any>(),
    findMany: jest.fn<any>(),
    create: jest.fn<any>(),
    update: jest.fn<any>(),
    delete: jest.fn<any>(),
    ...overrides.systemState,
  };
  const $executeRawUnsafe: jest.Mock<any> = overrides.$executeRawUnsafe ?? jest.fn<any>();
  const $executeRaw: jest.Mock<any> = overrides.$executeRaw ?? jest.fn<any>();

  const mockForTx = { reviewQueue, event, queueOrder, systemState, $executeRawUnsafe, $executeRaw };
  const $transaction: jest.Mock<any> = overrides.$transaction ?? jest.fn<any>().mockImplementation((fn: (tx: unknown) => unknown) => fn(mockForTx));

  return {
    prisma: { ...mockForTx, $transaction } as unknown as PrismaClient,
    reviewQueue,
    event,
    queueOrder,
    systemState,
  };
};
