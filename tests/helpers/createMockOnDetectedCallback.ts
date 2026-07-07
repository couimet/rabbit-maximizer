import type { OnDetectedCallback } from '../../src/types/OnDetectedCallback.js';

import { jest } from '@jest/globals';

export const createMockOnDetectedCallback = (): jest.Mocked<OnDetectedCallback> =>
  jest.fn<any>().mockResolvedValue(undefined) as unknown as jest.Mocked<OnDetectedCallback>;
