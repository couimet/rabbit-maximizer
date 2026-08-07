import type { PRStateFetcher } from '../../src/github/index.js';

import { jest } from '@jest/globals';

export const createMockPRStateFetcher = (overrides?: Partial<jest.Mocked<PRStateFetcher>>): jest.Mocked<PRStateFetcher> =>
  ({
    fetch: jest.fn<any>().mockResolvedValue({ state: 'open', merged_at: null, closed_at: null }),
    ...overrides,
  }) as unknown as jest.Mocked<PRStateFetcher>;
