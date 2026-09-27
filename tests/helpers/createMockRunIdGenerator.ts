import type { RunIdGenerator } from '../../src/services.js';

import { jest } from '@jest/globals';

export const createMockRunIdGenerator = (overrides?: Partial<jest.Mocked<RunIdGenerator>>): jest.Mocked<RunIdGenerator> =>
  ({
    generate: jest.fn<any>(),
    ...overrides,
  }) as unknown as jest.Mocked<RunIdGenerator>;
