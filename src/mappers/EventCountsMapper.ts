import type { EventCountsResponse } from '../types/index.js';

import { injectable } from 'inversify';

@injectable()
export class EventCountsMapper {
  mapToResponse(counts: Record<string, number>): EventCountsResponse {
    return {
      detected: counts.detected ?? 0,
      enqueued: counts.enqueued ?? 0,
      retriggered: counts.retriggered ?? 0,
      failed: counts.failed ?? 0,
    };
  }
}
