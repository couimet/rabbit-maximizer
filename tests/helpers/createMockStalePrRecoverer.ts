import type { StalePrRecoverer } from '../../src/services.js';

import { jest } from '@jest/globals';

export const createMockStalePrRecoverer = (): jest.Mocked<StalePrRecoverer> => ({
  recover: jest.fn<any>().mockResolvedValue(undefined),
});
