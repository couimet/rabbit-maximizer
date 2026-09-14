import type { EventRepository } from '../db/index.js';
import type { EventEntryMapper } from '../mappers/index.js';
import { isValidUuid } from '../utils/index.js';

import { DEFAULT_PAGE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from './index.js';

import type { Logger } from '@couimet/logger-contract';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

const EVENTS_PAGE_SIZE = 50;
const RUN_ID_QUERY_PARAM = 'runId';
const RUN_PROMPT_PREFIX = 'run=';

/** Accepts the bare UUID or the `run=<uuid>` token as it appears in a posted comment footer. */
const parseRunIdFilter = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  const bare = trimmed.startsWith(RUN_PROMPT_PREFIX) ? trimmed.slice(RUN_PROMPT_PREFIX.length) : trimmed;
  return bare === '' ? undefined : bare;
};

export const createGetEventsHandler = (eventRepo: EventRepository, eventEntryMapper: EventEntryMapper, logger: Logger) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const page = Math.max(DEFAULT_PAGE, parseInt(String(req.query.page)) || DEFAULT_PAGE);
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, parseInt(String(req.query.pageSize)) || EVENTS_PAGE_SIZE));
      const skip = (page - 1) * pageSize;

      const runId = parseRunIdFilter(req.query[RUN_ID_QUERY_PARAM]);
      if (runId !== undefined && !isValidUuid(runId)) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'runId must be a valid UUID v4' });
        return;
      }

      const { items, total } = await eventRepo.listRecent(skip, pageSize, runId);
      const data = eventEntryMapper.mapToEventEntryResponseList(items);

      res.json({ data, total, page, pageSize });
    } catch (error) {
      logger.error({ fn: 'api.getEvents', error }, 'Failed to get events');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get events' });
    }
  };
};
