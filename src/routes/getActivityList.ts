import type { QueueRepository } from '../db/index.js';
import type { ReviewQueueToActivityListItemMapper } from '../mappers/index.js';

import { DEFAULT_PAGE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from './index.js';

import type { Logger } from '@couimet/logger-contract';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

const ACTIVITY_LIST_PAGE_SIZE = 50;

export const createGetActivityListHandler = (queueRepo: QueueRepository, activityListMapper: ReviewQueueToActivityListItemMapper, logger: Logger) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const sinceRaw = req.query.since;
      if (typeof sinceRaw !== 'string' || sinceRaw.length === 0) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'since must be a valid ISO 8601 datetime' });
        return;
      }
      const since = new Date(sinceRaw);
      if (isNaN(since.getTime())) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'since must be a valid ISO 8601 datetime' });
        return;
      }

      const page = Math.max(DEFAULT_PAGE, parseInt(String(req.query.page)) || DEFAULT_PAGE);
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, parseInt(String(req.query.pageSize)) || ACTIVITY_LIST_PAGE_SIZE));
      const skip = (page - 1) * pageSize;

      const { items, total } = await queueRepo.getActivityList(since, skip, pageSize);
      const data = await activityListMapper.mapToList(items);

      res.json({ data, total, page, pageSize });
    } catch (error) {
      logger.error({ fn: 'api.getActivityList', error }, 'Failed to get activity list');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get activity list' });
    }
  };
};
