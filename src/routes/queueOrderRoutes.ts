import type { QueueOrderRepository } from '../db/queueOrderRepository.js';
import type { QueueRepository } from '../db/queueRepository.js';
import type { SystemStateRepository } from '../db/systemStateRepository.js';
import { RabbitMaximizerError } from '../errors/RabbitMaximizerError.js';
import { RabbitMaximizerErrorCodes } from '../errors/RabbitMaximizerErrorCodes.js';
import { ReviewTrigger } from '../ReviewTrigger.js';
import { QueueStatus, TriggerSource } from '../types/index.js';
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

export const createRetriggerNowHandler = (
  queueOrderRepo: QueueOrderRepository,
  systemStateRepo: SystemStateRepository,
  reviewTrigger: ReviewTrigger,
  logger: Logger,
) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const uuid = req.params.uuid as string;
      if (!isValidUuid(uuid)) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'uuid must be a valid UUID v4' });
        return;
      }

      if (await systemStateRepo.isSchedulerPaused()) {
        if (req.query.overridePause !== 'true') {
          logger.info({ fn: 'api.queueOrder.retriggerNow', uuid }, 'Retrigger blocked: scheduler is paused');
          res.status(StatusCodes.CONFLICT).json({ error: 'Maximizer is paused; resume it before retriggering' });
          return;
        }
        logger.info({ fn: 'api.queueOrder.retriggerNow', uuid }, 'Retriggering while scheduler is paused (overridePause=true)');
      }

      const items = await queueOrderRepo.getEffectiveOrder({ eligibleOnly: false });
      const item = items.find((i) => i.uuid === uuid);
      if (!item) {
        logger.warn({ fn: 'api.queueOrder.retriggerNow', uuid }, 'Queue item not found');
        res.status(StatusCodes.NOT_FOUND).json({ error: 'Queue item not found' });
        return;
      }
      if (item.status !== QueueStatus.pending) {
        logger.warn({ fn: 'api.queueOrder.retriggerNow', uuid, status: item.status }, 'Queue item is not pending');
        res.status(StatusCodes.CONFLICT).json({ error: 'Queue item is not pending' });
        return;
      }

      const result = await reviewTrigger.trigger(item, TriggerSource.dashboard_retrigger_now);
      if (!result.success) {
        logger.warn({ fn: 'api.queueOrder.retriggerNow', uuid, error: result.error }, 'Failed to retrigger now');
        res.status(StatusCodes.CONFLICT).json({ error: 'Failed to retrigger now' });
        return;
      }

      res.status(StatusCodes.NO_CONTENT).end();
    } catch (error) {
      logger.error({ fn: 'api.queueOrder.retriggerNow', error }, 'Failed to retrigger now');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to retrigger now' });
    }
  };
};

export const createMoveToTopHandler = (queueOrderRepo: QueueOrderRepository, logger: Logger) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { queueItemUuid } = req.body ?? {};

      if (!isValidUuid(queueItemUuid)) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'queueItemUuid must be a valid UUID v4' });
        return;
      }

      await queueOrderRepo.moveToTop(queueItemUuid);

      res.status(StatusCodes.NO_CONTENT).end();
    } catch (error) {
      if (error instanceof RabbitMaximizerError) {
        if (error.code === RabbitMaximizerErrorCodes.QUEUE_ITEM_NOT_FOUND) {
          res.status(StatusCodes.NOT_FOUND).json({ error: error.message });
          return;
        }
        if (error.code === RabbitMaximizerErrorCodes.QUEUE_ITEM_NOT_PENDING) {
          res.status(StatusCodes.CONFLICT).json({ error: error.message });
          return;
        }
      }
      logger.error({ fn: 'api.queueOrder.moveToTop', error }, 'Failed to move item to top');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to move item to top' });
    }
  };
};

export const createMarkReviewedHandler = (queueRepo: QueueRepository, logger: Logger) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const uuid = req.params.uuid as string;
      if (!isValidUuid(uuid)) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'uuid must be a valid UUID v4' });
        return;
      }

      const item = await queueRepo.markReviewedByUuid(uuid);
      if (!item) {
        res.status(StatusCodes.NOT_FOUND).json({ error: `Queue item not found: ${uuid}` });
        return;
      }

      res.json({ ok: true });
    } catch (error) {
      logger.error({ fn: 'api.queueOrder.markReviewed', error }, 'Failed to mark item reviewed');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to mark item reviewed' });
    }
  };
};
