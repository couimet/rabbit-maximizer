import type { EventRepository } from '../db/eventRepository.js';
import type { QueueRepository } from '../db/queueRepository.js';

import type { Logger } from '@couimet/logger-contract';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

const MILLISECONDS_IN_24_HOURS = 86_400_000;

export const createGetSummaryHandler = (queueRepo: QueueRepository, eventRepo: EventRepository, logger: Logger) => {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const [queueCounts, eventCounts24h, oldestPending] = await Promise.all([
        queueRepo.getCountsByStatus(),
        eventRepo.countByType(new Date(Date.now() - MILLISECONDS_IN_24_HOURS)),
        queueRepo.getOldestPending(),
      ]);

      res.json({ queueCounts, eventCounts24h, oldestPending });
    } catch (error) {
      logger.error({ fn: 'api.getSummary', error }, 'Failed to get summary');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get summary' });
    }
  };
};
