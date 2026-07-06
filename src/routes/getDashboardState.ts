import type { EventRepository } from '../db/eventRepository.js';
import type { QueueOrderRepository } from '../db/queueOrderRepository.js';
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

export const createGetDashboardStateHandler = (queueOrderRepo: QueueOrderRepository, eventRepo: EventRepository, logger: Logger) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const rawDuration = typeof req.query.duration === 'string' ? req.query.duration : '';
      const duration = Object.hasOwn(DURATION_MS, rawDuration) ? rawDuration : DEFAULT_DURATION;
      const since = new Date(Date.now() - DURATION_MS[duration]);

      const [items, eventCounts] = await Promise.all([queueOrderRepo.getEffectiveOrder({ eligibleOnly: false }), eventRepo.countByType(since)]);

      const { bypassed: _ecBypassed, completed: _ecCompleted, ...activeEventCounts } = eventCounts;

      const now = new Date();
      const futureItems = items.filter((item) => item.not_before > now);
      const nextReviewAvailableAt =
        futureItems.length > 0
          ? futureItems.reduce((min, item) => (item.not_before < min ? item.not_before : min), futureItems[0].not_before).toISOString()
          : null;

      res.json({ nextReviewAvailableAt, pendingItems: items, eventCounts: activeEventCounts });
    } catch (error) {
      logger.error({ fn: 'api.dashboardState', error }, 'Failed to get dashboard state');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get dashboard state' });
    }
  };
};
