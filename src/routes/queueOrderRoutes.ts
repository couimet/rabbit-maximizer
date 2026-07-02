import type { QueueOrderRepository } from '../db/queueOrderRepository.js';

import type { Logger } from '@couimet/logger-contract';
import type { Request, Response } from 'express';

export const createGetQueueOrderHandler = (queueOrderRepo: QueueOrderRepository, logger: Logger) => {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const items = await queueOrderRepo.getEffectiveOrder();
      res.json({ data: items });
    } catch (error) {
      logger.error({ fn: 'api.queueOrder.get', error }, 'Failed to get queue order');
      res.status(500).json({ error: 'Failed to get queue order' });
    }
  };
};

export const createMoveQueueOrderHandler = (queueOrderRepo: QueueOrderRepository, logger: Logger) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { queueItemIds, direction } = req.body;

      if (!Array.isArray(queueItemIds) || queueItemIds.length === 0) {
        res.status(400).json({ error: 'queueItemIds must be a non-empty array of positive integers' });
        return;
      }
      if (queueItemIds.some((id: unknown) => typeof id !== 'number' || id < 1 || !Number.isInteger(id))) {
        res.status(400).json({ error: 'queueItemIds must be a non-empty array of positive integers' });
        return;
      }

      if (direction !== 'up' && direction !== 'down') {
        res.status(400).json({ error: 'direction must be "up" or "down"' });
        return;
      }

      const currentOrder = await queueOrderRepo.getEffectiveOrder();
      const currentIds = new Set(currentOrder.map((item) => item.id));
      const missingIds = queueItemIds.filter((id: number) => !currentIds.has(id));
      if (missingIds.length > 0) {
        res.status(404).json({ error: `Queue items not found: ${missingIds.join(', ')}` });
        return;
      }

      const updatedOrder = await queueOrderRepo.moveItems(queueItemIds, direction);

      res.json({ data: updatedOrder });
    } catch (error) {
      logger.error({ fn: 'api.queueOrder.move', error }, 'Failed to move queue items');
      res.status(500).json({ error: 'Failed to move queue items' });
    }
  };
};
