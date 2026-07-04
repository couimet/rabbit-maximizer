import type { EventRepository } from '../db/eventRepository.js';
import type { QueueRepository } from '../db/queueRepository.js';
import { DEFAULT_DURATION, MS_PER_DAY } from '../utils/durations.js';

import type { Logger } from '@couimet/logger-contract';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

const DURATION_MS: Record<string, number> = {
  [DEFAULT_DURATION]: MS_PER_DAY,
  '2d': 2 * MS_PER_DAY,
  '3d': 3 * MS_PER_DAY,
  '5d': 5 * MS_PER_DAY,
  '1w': 7 * MS_PER_DAY,
};

export const createGetSummaryHandler = (queueRepo: QueueRepository, eventRepo: EventRepository, logger: Logger) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const rawDuration = typeof req.query.duration === 'string' ? req.query.duration : '';
      const duration = rawDuration in DURATION_MS ? rawDuration : DEFAULT_DURATION;
      const since = new Date(Date.now() - DURATION_MS[duration]);

      const [queueCounts, eventCounts, oldestPending] = await Promise.all([
        queueRepo.getCountsByStatus(),
        eventRepo.countByType(since),
        queueRepo.getOldestPending(),
      ]);

      const { completed: _qcCompleted, ...activeQueueCounts } = queueCounts;
      const { bypassed: _ecBypassed, completed: _ecCompleted, ...activeEventCounts } = eventCounts;

      res.json({ queueCounts: activeQueueCounts, eventCounts24h: activeEventCounts, oldestPending });
    } catch (error) {
      logger.error({ fn: 'api.getSummary', error }, 'Failed to get summary');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get summary' });
    }
  };
};
