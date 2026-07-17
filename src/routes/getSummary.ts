import type { EventRepository } from '../db/eventRepository.js';
import type { QueueRepository } from '../db/queueRepository.js';
import type { EventCountsMapper } from '../mappers/index.js';
import type { QueueItemMapper } from '../mappers/index.js';
import type { SummaryResponse } from '../types/api.js';
import { resolveDurationSince } from '../utils/resolveDurationSince.js';

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
      const mappedPending = oldestPending ? queueItemMapper.mapToQueueItemResponse(oldestPending) : null;

      const response: SummaryResponse = { queueCounts, eventCounts: activeEventCounts, oldestPending: mappedPending };
      res.json(response);
    } catch (error) {
      logger.error({ fn: 'api.getSummary', error }, 'Failed to get summary');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get summary' });
    }
  };
};
