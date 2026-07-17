import type { EventRepository } from '../db/eventRepository.js';
import type { EventEntryMapper } from '../mappers/index.js';

import { DEFAULT_PAGE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from './pagination.js';

import type { Logger } from '@couimet/logger-contract';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

const EVENTS_PAGE_SIZE = 50;

export const createGetEventsHandler = (eventRepo: EventRepository, eventEntryMapper: EventEntryMapper, logger: Logger) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const page = Math.max(DEFAULT_PAGE, parseInt(String(req.query.page)) || DEFAULT_PAGE);
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, parseInt(String(req.query.pageSize)) || EVENTS_PAGE_SIZE));
      const skip = (page - 1) * pageSize;

      const { items, total } = await eventRepo.listRecent(skip, pageSize);
      const data = eventEntryMapper.mapToEventEntryResponseList(items);

      res.json({ data, total, page, pageSize });
    } catch (error) {
      logger.error({ fn: 'api.getEvents', error }, 'Failed to get events');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get events' });
    }
  };
};
