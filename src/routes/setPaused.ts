import type { SystemStateRepository } from '../db/systemStateRepository.js';

import type { Logger } from '@couimet/logger-contract';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const createSetPausedHandler = (systemStateRepo: SystemStateRepository, logger: Logger) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      if (typeof req.body?.paused !== 'boolean') {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'paused must be a boolean' });
        return;
      }

      if (req.body.paused) {
        await systemStateRepo.pauseScheduler();
        logger.info({ fn: 'api.pause' }, 'Scheduler paused');
      } else {
        await systemStateRepo.resumeScheduler();
        logger.info({ fn: 'api.pause' }, 'Scheduler resumed');
      }

      res.json({ paused: req.body.paused });
    } catch (error) {
      logger.error({ fn: 'api.pause', error }, 'Failed to set pause state');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to set pause state' });
    }
  };
};
