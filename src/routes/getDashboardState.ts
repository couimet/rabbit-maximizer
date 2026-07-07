import type { EventRepository } from '../db/eventRepository.js';
import type { QueueOrderRepository } from '../db/queueOrderRepository.js';
import { resolveDurationSince } from '../utils/resolveDurationSince.js';

import type { Logger } from '@couimet/logger-contract';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const createGetDashboardStateHandler = (queueOrderRepo: QueueOrderRepository, eventRepo: EventRepository, logger: Logger) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const since = resolveDurationSince(req.query.duration);

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
