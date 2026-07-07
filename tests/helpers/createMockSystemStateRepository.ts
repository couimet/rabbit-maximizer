import type { SystemStateRepository } from '../../src/db/systemStateRepository.js';

import { jest } from '@jest/globals';

export const createMockSystemStateRepository = (overrides?: Partial<jest.Mocked<SystemStateRepository>>): jest.Mocked<SystemStateRepository> =>
  ({
    getState: jest.fn<any>(),
    setState: jest.fn<any>(),
    ...overrides,
  }) as unknown as jest.Mocked<SystemStateRepository>;
