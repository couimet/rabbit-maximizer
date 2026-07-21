import type { ObservationContext } from '../../src/observability/observationContext.js';

import { getUuid } from '@couimet/dynamic-testing';

export const generateObservationContextHydrationData = (overrides?: Partial<ObservationContext>): ObservationContext => ({
  correlationId: getUuid(),
  requestId: getUuid(),
  version: '1.0.0',
  ...overrides,
});
