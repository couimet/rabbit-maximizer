import type { SystemStateRepository } from '../../src/db/index.js';

import { jest } from '@jest/globals';

export const createMockSystemStateRepository = (overrides?: Partial<jest.Mocked<SystemStateRepository>>): jest.Mocked<SystemStateRepository> =>
  ({
    getDashboardSystemState: jest.fn<any>().mockResolvedValue({ paused: false, lastSchedulerTickAt: undefined, nextReviewAvailableAt: undefined }),
    isSchedulerPaused: jest.fn<any>().mockResolvedValue(false),
    pauseScheduler: jest.fn<any>(),
    resumeScheduler: jest.fn<any>(),
    getNextReviewAvailableAt: jest.fn<any>(),
    setNextReviewAvailableAt: jest.fn<any>(),
    getLastSchedulerTickAt: jest.fn<any>(),
    setLastSchedulerTickAt: jest.fn<any>(),
    getLastScanCompletedAt: jest.fn<any>(),
    setLastScanCompletedAt: jest.fn<any>(),
    setLastScanStartedAt: jest.fn<any>(),
    ...overrides,
  }) as unknown as jest.Mocked<SystemStateRepository>;
