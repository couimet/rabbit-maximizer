import type { EventRepository, QueueOrderRepository, SystemStateRepository } from '../db/index.js';
import type { EventCountsMapper, QueueItemMapper } from '../mappers/index.js';
import { resolveDurationSince } from '../utils/index.js';

import type { Logger } from '@couimet/logger-contract';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const createGetDashboardStateHandler = (
  queueOrderRepo: QueueOrderRepository,
  eventRepo: EventRepository,
  systemStateRepo: SystemStateRepository,
  queueItemMapper: QueueItemMapper,
  eventCountsMapper: EventCountsMapper,
  logger: Logger,
) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const since = resolveDurationSince(req.query.duration);

      const [items, eventCounts, paused] = await Promise.all([
        queueOrderRepo.getEffectiveOrder(),
        eventRepo.countByType(since),
        systemStateRepo.isSchedulerPaused(),
      ]);
      const activeEventCounts = eventCountsMapper.mapToResponse(eventCounts);
      const pendingItems = await queueItemMapper.mapToQueueItemResponseList(items);

      const nextReviewAvailableAt: string | null = null;

      res.json({ nextReviewAvailableAt, pendingItems, eventCounts: activeEventCounts, paused });
    } catch (error) {
      logger.error({ fn: 'api.dashboardState', error }, 'Failed to get dashboard state');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get dashboard state' });
    }
  };
};
