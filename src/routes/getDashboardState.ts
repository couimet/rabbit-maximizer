import type { EventRepository } from '../db/eventRepository.js';
import type { QueueOrderRepository } from '../db/queueOrderRepository.js';
import type { SystemStateRepository } from '../db/systemStateRepository.js';
import type { EventCountsMapper } from '../mappers/index.js';
import type { QueueItemMapper } from '../mappers/index.js';
import { resolveDurationSince } from '../utils/resolveDurationSince.js';

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
        queueOrderRepo.getEffectiveOrder({ eligibleOnly: false }),
        eventRepo.countByType(since),
        systemStateRepo.isSchedulerPaused(),
      ]);
      const activeEventCounts = eventCountsMapper.mapToResponse(eventCounts);
      const pendingItems = queueItemMapper.mapToQueueItemResponseList(items);

      const now = new Date();
      const hasEligibleNow = items.some((item) => item.not_before <= now);
      const nextReviewAvailableAt =
        !hasEligibleNow && items.length > 0
          ? items.reduce((min, item) => (item.not_before < min ? item.not_before : min), items[0].not_before).toISOString()
          : null;

      res.json({ nextReviewAvailableAt, pendingItems, eventCounts: activeEventCounts, paused });
    } catch (error) {
      logger.error({ fn: 'api.dashboardState', error }, 'Failed to get dashboard state');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get dashboard state' });
    }
  };
};
