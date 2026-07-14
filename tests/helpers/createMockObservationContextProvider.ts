import type { ObservationContextProvider } from '../../src/observability/observationContext.js';

import { createMockObservationContext } from './createMockObservationContext.js';

import { jest } from '@jest/globals';

export const createMockObservationContextProvider = (overrides?: Partial<jest.Mocked<ObservationContextProvider>>): jest.Mocked<ObservationContextProvider> => {
  const context = createMockObservationContext({ version: '1.0.0-test' });
  return {
    current: jest.fn<any>().mockReturnValue(context),
    ...overrides,
  } as unknown as jest.Mocked<ObservationContextProvider>;
};
