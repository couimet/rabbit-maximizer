import type { EventRepository } from '../db/eventRepository.js';

import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from './pagination.js';

import type { Logger } from '@couimet/logger-contract';
import type { Request, Response } from 'express';

export const createGetEventsHandler = (eventRepo: EventRepository, logger: Logger) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const page = Math.max(DEFAULT_PAGE, parseInt(String(req.query.page)) || DEFAULT_PAGE);
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, parseInt(String(req.query.pageSize)) || DEFAULT_PAGE_SIZE));
      const skip = (page - 1) * pageSize;

      const { items, total } = await eventRepo.listRecent(skip, pageSize);

      res.json({ data: items, total, page, pageSize });
    } catch (error) {
      logger.error({ fn: 'api.getEvents', error }, 'Failed to get events');
      res.status(500).json({ error: 'Failed to get events' });
    }
  };
};
