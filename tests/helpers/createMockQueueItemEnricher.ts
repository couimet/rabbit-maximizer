import type { QueueItemEnricher } from '../../src/services.js';
import type { QueueItem } from '../../src/types/QueueItem.js';

export const createMockQueueItemEnricher = (): QueueItemEnricher =>
  ({
    enrich: (items: QueueItem[]) => Promise.resolve(items),
  }) as unknown as QueueItemEnricher;
