import type { Pruner } from '../../src/services.js';

import { jest } from '@jest/globals';

export const createMockPruner = (overrides?: Partial<jest.Mocked<Pruner>>): jest.Mocked<Pruner> =>
  ({
    prune: jest.fn<any>().mockResolvedValue(undefined),
    ...overrides,
  }) as unknown as jest.Mocked<Pruner>;
