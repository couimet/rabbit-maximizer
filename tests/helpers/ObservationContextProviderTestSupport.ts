import type { ObservationContextProvider } from '../../src/observability/index.js';

import { generateObservationContextHydrationData } from './ObservationContextTestSupport.js';

import { jest } from '@jest/globals';

export const createMockObservationContextProvider = (overrides?: Partial<jest.Mocked<ObservationContextProvider>>): jest.Mocked<ObservationContextProvider> => {
  const context = generateObservationContextHydrationData({ version: '1.0.0-test' });
  return {
    current: jest.fn<any>().mockReturnValue(context),
    ...overrides,
  } as unknown as jest.Mocked<ObservationContextProvider>;
};
