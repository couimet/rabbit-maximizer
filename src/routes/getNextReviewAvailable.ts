import type { QueueRepository } from '../db/queueRepository.js';
import type { SystemStateRepository } from '../db/systemStateRepository.js';
import { StateKey } from '../db/systemStateRepository.js';

import type { Logger } from '@couimet/logger-contract';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const createGetNextReviewAvailableHandler = (systemStateRepo: SystemStateRepository, queueRepo: QueueRepository, logger: Logger) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const value = await systemStateRepo.getState(StateKey.nextReviewAvailableAt);

      if (value && value > new Date()) {
        res.json({ next_review_available_at: value.toISOString() });
        return;
      }

      const oldestPending = await queueRepo.getOldestPending();
      if (oldestPending && oldestPending.not_before > new Date()) {
        res.json({ next_review_available_at: oldestPending.not_before.toISOString() });
        return;
      }

      res.json({ next_review_available_at: null });
    } catch (error) {
      logger.error({ fn: 'api.getNextReviewAvailable', error }, 'Failed to get next review available time');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get next review available time' });
    }
  };
};
