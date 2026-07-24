import type { Config } from '../config.js';
import { type EventRepository, type QueueOrderRepository, type SystemStateRepository } from '../db/index.js';
import type { EventCountsMapper, QueueItemMapper } from '../mappers/index.js';
import { MS_PER_SECOND, resolveDurationSince } from '../utils/index.js';

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
  config: Config,
) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const since = resolveDurationSince(req.query.duration);

      const [items, eventCounts, paused, lastSchedulerTickAt] = await Promise.all([
        queueOrderRepo.getEffectiveOrder(),
        eventRepo.countByType(since),
        systemStateRepo.isSchedulerPaused(),
        systemStateRepo.getLastSchedulerTickAt(),
      ]);
      const activeEventCounts = eventCountsMapper.mapToResponse(eventCounts);
      const pendingItems = await queueItemMapper.mapToQueueItemResponseList(items);

      const nextReviewAvailableAt: string | null = null;

      const staleThresholdMs = config.SCHEDULER_STALE_TICK_MULTIPLIER * config.SCHEDULER_TICK_INTERVAL_SEC * MS_PER_SECOND;
      const schedulerStale = lastSchedulerTickAt === undefined || Date.now() - lastSchedulerTickAt.getTime() > staleThresholdMs;

      res.json({
        lastSchedulerTickAt: lastSchedulerTickAt?.toISOString() ?? null,
        nextReviewAvailableAt,
        pendingItems,
        eventCounts: activeEventCounts,
        paused,
        schedulerStale,
      });
    } catch (error) {
      logger.error({ fn: 'api.dashboardState', error }, 'Failed to get dashboard state');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get dashboard state' });
    }
  };
};
