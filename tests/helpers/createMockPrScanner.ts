import type { PrScanner } from '../../src/prScanner.js';

import { jest } from '@jest/globals';

export const createMockPrScanner = (): jest.Mocked<PrScanner> => ({
  scan: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
});
