import type { EventRepository, QueueRepository } from '../db/index.js';
import type { EventCountsMapper, QueueItemMapper } from '../mappers/index.js';
import type { SummaryResponse } from '../types/index.js';
import { resolveDurationSince } from '../utils/index.js';

import type { Logger } from '@couimet/logger-contract';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const createGetSummaryHandler = (
  queueRepo: QueueRepository,
  eventRepo: EventRepository,
  queueItemMapper: QueueItemMapper,
  eventCountsMapper: EventCountsMapper,
  logger: Logger,
) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const since = resolveDurationSince(req.query.duration);

      const [eventCounts, oldestPending, queueCounts] = await Promise.all([
        eventRepo.countByType(since),
        queueRepo.getOldestPending(),
        queueRepo.getCountsByStatus(),
      ]);

      const activeEventCounts = eventCountsMapper.mapToResponse(eventCounts);
      const [enrichedPending] = oldestPending ? await queueItemMapper.mapToQueueItemResponseList([oldestPending]) : [];
      const mappedPending = enrichedPending ?? null;

      const response: SummaryResponse = { queueCounts, eventCounts: activeEventCounts, oldestPending: mappedPending };
      res.json(response);
    } catch (error) {
      logger.error({ fn: 'api.getSummary', error }, 'Failed to get summary');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get summary' });
    }
  };
};
