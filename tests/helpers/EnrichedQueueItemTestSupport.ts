import { PrState } from '../../src/domain.js';
import type { EnrichedQueueItem } from '../../src/types/index.js';

import { generateQueueItemHydrationData } from './QueueItemTestSupport.js';

import { getRandomEnumValue, getUniqueDate } from '@couimet/dynamic-testing';

export const generateEnrichedQueueItemData = (overrides?: Partial<EnrichedQueueItem>): EnrichedQueueItem => {
  const base = generateQueueItemHydrationData(overrides);
  return {
    ...base,
    prState: getRandomEnumValue(PrState),
    lastCoderabbitAcknowledgedAt: getUniqueDate(),
    ...overrides,
  };
};
