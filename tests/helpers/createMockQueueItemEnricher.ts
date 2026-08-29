import type { QueueItem } from '../../src/types/QueueItem.js';
import type { QueueItemEnricher } from '../../src/utils/index.js';

export const createMockQueueItemEnricher = (): QueueItemEnricher =>
  ({
    enrich: (items: QueueItem[]) => Promise.resolve(items),
  }) as unknown as QueueItemEnricher;
