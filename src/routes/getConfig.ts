import type { Config } from '../config.js';

import type { Logger } from '@couimet/logger-contract';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const createGetConfigHandler = (config: Config, logger: Logger) => {
  return (_req: Request, res: Response): void => {
    try {
      res.json({
        pauseNotificationInitialDelaySec: config.PAUSE_NOTIFICATION_INITIAL_DELAY_SEC,
        pauseNotificationRepeatIntervalSec: config.PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC,
      });
    } catch (error) {
      logger.error({ fn: 'api.config', error }, 'Failed to get config');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get config' });
    }
  };
};
