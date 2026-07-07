import type { EventRepository } from '../db/eventRepository.js';
import type { QueueRepository } from '../db/queueRepository.js';
import { filterActiveEventCounts } from '../utils/filterActiveEventCounts.js';
import { resolveDurationSince } from '../utils/resolveDurationSince.js';

import type { Logger } from '@couimet/logger-contract';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const createGetSummaryHandler = (queueRepo: QueueRepository, eventRepo: EventRepository, logger: Logger) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const since = resolveDurationSince(req.query.duration);

      const [eventCounts, oldestPending] = await Promise.all([eventRepo.countByType(since), queueRepo.getOldestPending()]);

      const activeEventCounts = filterActiveEventCounts(eventCounts);

      res.json({ eventCounts: activeEventCounts, oldestPending });
    } catch (error) {
      logger.error({ fn: 'api.getSummary', error }, 'Failed to get summary');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get summary' });
    }
  };
};
