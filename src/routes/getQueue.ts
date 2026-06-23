import type { QueueRepository } from '../db/queueRepository.js';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './pagination.js';

import type { Logger } from '@couimet/logger-contract';
import type { Request, Response } from 'express';

export const createGetQueueHandler = (queueRepo: QueueRepository, logger: Logger) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const page = Math.max(DEFAULT_PAGE, parseInt(String(req.query.page)) || DEFAULT_PAGE);
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(String(req.query.pageSize)) || DEFAULT_PAGE_SIZE));
      const skip = (page - 1) * pageSize;

      const { items, total } = await queueRepo.getAll(skip, pageSize);

      res.json({ data: items, total, page, pageSize });
    } catch (error) {
      logger.error({ fn: 'api.getQueue', error }, 'Failed to get queue');
      res.status(500).json({ error: 'Failed to get queue' });
    }
  };
};
