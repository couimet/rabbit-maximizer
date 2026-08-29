import type { OnDetectedCallback } from '../../src/types/index.js';

import { jest } from '@jest/globals';

export const createMockOnDetectedCallback = (): jest.Mocked<OnDetectedCallback> =>
  jest.fn<any>().mockResolvedValue(undefined) as unknown as jest.Mocked<OnDetectedCallback>;
