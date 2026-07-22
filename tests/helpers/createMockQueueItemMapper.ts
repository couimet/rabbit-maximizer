import { QueueItemMapper } from '../../src/mappers/index.js';

import { createMockQueueItemEnricher } from './createMockQueueItemEnricher.js';

export const createMockQueueItemMapper = (): QueueItemMapper => new QueueItemMapper(createMockQueueItemEnricher());
