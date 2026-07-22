import type { SystemStateRepository } from '../../src/db/index.js';

import { jest } from '@jest/globals';

export const createMockSystemStateRepository = (overrides?: Partial<jest.Mocked<SystemStateRepository>>): jest.Mocked<SystemStateRepository> =>
  ({
    getState: jest.fn<any>(),
    setState: jest.fn<any>(),
    isSchedulerPaused: jest.fn<any>().mockResolvedValue(false),
    pauseScheduler: jest.fn<any>(),
    resumeScheduler: jest.fn<any>(),
    ...overrides,
  }) as unknown as jest.Mocked<SystemStateRepository>;
