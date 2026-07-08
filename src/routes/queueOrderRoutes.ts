import type { Config } from '../config.js';
import type { QueueOrderRepository } from '../db/queueOrderRepository.js';
import type { QueueRepository } from '../db/queueRepository.js';
import type { SystemStateRepository } from '../db/systemStateRepository.js';
import { QueueStatus, TriggerSource } from '../types/index.js';
import { MS_PER_SECOND } from '../utils/durations.js';
import { isValidUuid } from '../utils/uuidLookup.js';

import type { Logger } from '@couimet/logger-contract';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const createGetQueueOrderHandler = (queueOrderRepo: QueueOrderRepository, logger: Logger) => {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const items = await queueOrderRepo.getEffectiveOrder({ eligibleOnly: false });
      res.json({ data: items });
    } catch (error) {
      logger.error({ fn: 'api.queueOrder.get', error }, 'Failed to get queue order');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get queue order' });
    }
  };
};

export const createMoveQueueOrderHandler = (queueOrderRepo: QueueOrderRepository, logger: Logger) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { queueItemUuids, direction } = req.body ?? {};

      if (!Array.isArray(queueItemUuids) || queueItemUuids.length === 0) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'queueItemUuids must be a non-empty array of UUID v4 strings' });
        return;
      }
      if (queueItemUuids.some((uuid: unknown) => !isValidUuid(uuid))) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'queueItemUuids must be a non-empty array of UUID v4 strings' });
        return;
      }

      if (direction !== 'up' && direction !== 'down') {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'direction must be "up" or "down"' });
        return;
      }

      const currentOrder = await queueOrderRepo.getEffectiveOrder({ eligibleOnly: false });
      const currentUuids = new Set(currentOrder.map((item) => item.uuid));
      const missingUuids = queueItemUuids.filter((uuid: string) => !currentUuids.has(uuid));
      if (missingUuids.length > 0) {
        res.status(StatusCodes.NOT_FOUND).json({ error: `Queue items not found: ${missingUuids.join(', ')}` });
        return;
      }

      const updatedOrder = await queueOrderRepo.moveItems(queueItemUuids, direction);

      res.json({ data: updatedOrder });
    } catch (error) {
      logger.error({ fn: 'api.queueOrder.move', error }, 'Failed to move queue items');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to move queue items' });
    }
  };
};

export const createRetriggerNowHandler = (queueOrderRepo: QueueOrderRepository, systemStateRepo: SystemStateRepository, config: Config, logger: Logger) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const uuid = req.params.uuid as string;
      if (!isValidUuid(uuid)) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'uuid must be a valid UUID v4' });
        return;
      }

      if (await systemStateRepo.isSchedulerPaused()) {
        res.status(StatusCodes.CONFLICT).json({ error: 'Maximizer is paused; resume it before retriggering' });
        return;
      }

      const items = await queueOrderRepo.getEffectiveOrder({ eligibleOnly: false });
      const item = items.find((i) => i.uuid === uuid);
      if (!item) {
        res.status(StatusCodes.NOT_FOUND).json({ error: `Queue item not found: ${uuid}` });
        return;
      }
      if (item.status !== QueueStatus.pending) {
        res.status(StatusCodes.CONFLICT).json({ error: `Queue item is not pending: ${uuid}` });
        return;
      }

      await queueOrderRepo.moveToTop(uuid, TriggerSource.dashboard_retrigger_now);

      res.json({ ok: true, schedulerTickIntervalSec: config.SCHEDULER_TICK_INTERVAL_MS / MS_PER_SECOND });
    } catch (error) {
      logger.error({ fn: 'api.queueOrder.retriggerNow', error }, 'Failed to retrigger now');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to retrigger now' });
    }
  };
};

export const createMarkCompletedHandler = (queueRepo: QueueRepository, logger: Logger) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const uuid = req.params.uuid as string;
      if (!isValidUuid(uuid)) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'uuid must be a valid UUID v4' });
        return;
      }

      const item = await queueRepo.markCompletedByUuid(uuid, undefined!);
      if (!item) {
        res.status(StatusCodes.NOT_FOUND).json({ error: `Queue item not found: ${uuid}` });
        return;
      }

      res.json({ ok: true });
    } catch (error) {
      logger.error({ fn: 'api.queueOrder.markCompleted', error }, 'Failed to mark item completed');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to mark item completed' });
    }
  };
};
