import type { EnrichedQueueItem } from '../../src/types/index.js';

import { generateQueueItemHydrationData } from './QueueItemTestSupport.js';

export const generateEnrichedQueueItemData = (overrides?: Partial<EnrichedQueueItem>): EnrichedQueueItem =>
  generateQueueItemHydrationData(overrides) as unknown as EnrichedQueueItem;
