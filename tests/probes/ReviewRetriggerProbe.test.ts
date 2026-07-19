import type { EventRepository } from '../../src/db/eventRepository.js';
import type { ObservationContext } from '../../src/observability/observationContext.js';
import { ReviewRetriggerProbe } from '../../src/probes/ReviewRetriggerProbe.js';
import { EventType, type QueueItem } from '../../src/types/index.js';
import { createMockEventRepo } from '../helpers/index.js';
import { makeQueueItem } from '../helpers/makeQueueItem.js';

import { getUniqueDate, getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Prisma } from '@prisma/client';

const TX = {} as Prisma.TransactionClient;

const LOGGING_CTX = (item: QueueItem) => (fn: string) => ({ fn, repo: item.repo_full_name, pr: item.pr_number, queueId: item.id });

describe('ReviewRetriggerProbe', () => {
  let events: jest.Mocked<EventRepository>;
  let logger: Logger;
  let observation: ObservationContext;

  beforeEach(() => {
    events = createMockEventRepo();
    logger = createMockLogger();
    observation = {
      correlationId: getUuid(),
      requestId: getUuid(),
      version: getUniqueString({ prefix: 'v' }),
    };
  });

  const createProbe = (item: QueueItem) => new ReviewRetriggerProbe(item, events, observation, logger);

  it('records event, and logs on reviewRetriggered', async () => {
    const item = makeQueueItem() as QueueItem;
    const cooldownUntil = getUniqueDate();
    const retriggeredCommentUrl = getUniqueString({ prefix: 'https://gh/c/' });

    const probe = createProbe(item);
    await probe.reviewRetriggered(retriggeredCommentUrl, cooldownUntil, TX);

    expect(events.record).toHaveBeenCalledWith(
      {
        type: EventType.retriggered,
        repo_full_name: item.repo_full_name,
        pr_number: item.pr_number,
        correlation_id: observation.correlationId,
        request_id: observation.requestId,
        version: observation.version,
        payload: {
          source_comment_url: item.source_comment_url,
          retriggered_comment_url: retriggeredCommentUrl,
        },
      },
      TX,
    );
    expect(logger.info).toHaveBeenCalledWith(LOGGING_CTX(item)('ReviewRetriggerProbe.reviewRetriggered'), 'Review retriggered');
  });

  it('logs on staleCommentRescheduled', () => {
    const item = makeQueueItem() as QueueItem;
    const cooldownUntil = getUniqueDate();

    const probe = createProbe(item);
    probe.staleCommentRescheduled(cooldownUntil);

    expect(logger.info).toHaveBeenCalledWith(
      { ...LOGGING_CTX(item)('ReviewRetriggerProbe.staleCommentRescheduled'), cooldownUntil },
      'Stale source comment replaced; rescheduled with updated cooldown time',
    );
  });

  it('logs on staleCommentSkipped', () => {
    const item = makeQueueItem() as QueueItem;

    const probe = createProbe(item);
    probe.staleCommentSkipped();

    expect(logger.warn).toHaveBeenCalledWith(LOGGING_CTX(item)('ReviewRetriggerProbe.staleCommentSkipped'), 'No replacement rate-limit comment found');
  });

  it('logs on staleCommentReplacementDeleted', () => {
    const item = makeQueueItem() as QueueItem;
    const REPLACEMENT_ID = getUniqueInt();

    const probe = createProbe(item);
    probe.staleCommentReplacementDeleted(REPLACEMENT_ID);

    expect(logger.warn).toHaveBeenCalledWith(
      { ...LOGGING_CTX(item)('ReviewRetriggerProbe.staleCommentReplacementDeleted'), commentId: REPLACEMENT_ID },
      'Replacement comment was deleted before fetch',
    );
  });
});
