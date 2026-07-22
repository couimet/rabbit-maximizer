import type { QueueRepository } from '../db/index.js';
import type { QueueItemMapper } from '../mappers/index.js';

import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from './index.js';

import type { Logger } from '@couimet/logger-contract';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const createGetQueueHandler = (queueRepo: QueueRepository, queueItemMapper: QueueItemMapper, logger: Logger) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const page = Math.max(DEFAULT_PAGE, parseInt(String(req.query.page)) || DEFAULT_PAGE);
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, parseInt(String(req.query.pageSize)) || DEFAULT_PAGE_SIZE));
      const skip = (page - 1) * pageSize;

      const { items, total } = await queueRepo.getAll(skip, pageSize);
      const data = await queueItemMapper.mapToQueueItemResponseList(items);

      res.json({ data, total, page, pageSize });
    } catch (error) {
      logger.error({ fn: 'api.getQueue', error }, 'Failed to get queue');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get queue' });
    }
  };
};
