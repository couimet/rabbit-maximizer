import type { HeadDriftRecoverer } from '../../src/services.js';

import { jest } from '@jest/globals';

export const createMockHeadDriftRecoverer = (): jest.Mocked<HeadDriftRecoverer> =>
  ({
    recover: jest.fn<any>().mockResolvedValue(undefined),
  }) as unknown as jest.Mocked<HeadDriftRecoverer>;
