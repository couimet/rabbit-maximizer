import type { EventRepository } from '../../src/db/eventRepository.js';
import type { QueueRepository } from '../../src/db/queueRepository.js';
import type { ObservationContext } from '../../src/observability/observationContext.js';
import { ReviewRetriggerProbe } from '../../src/probes/ReviewRetriggerProbe.js';
import { EventType, QueueStatus, TriggerSource } from '../../src/types/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { describe, expect, it, jest } from '@jest/globals';
import type { Prisma } from '@prisma/client';

const TX = {} as Prisma.TransactionClient;

const makeItem = () => ({
  id: getUniqueInt(),
  uuid: getUniqueString({ prefix: 'uuid-' }),
  repo_full_name: `${getUniqueString({ prefix: 'o' })}/${getUniqueString({ prefix: 'r' })}`,
  pr_number: getUniqueInt(),
  status: QueueStatus.pending,
  not_before: getUniqueDate(),
  attempts: 0,
  pr_title: getUniqueString({ prefix: 'PR title ' }),
  source_comment_url: getUniqueString({ prefix: 'https://gh/c/' }),
  source_comment_id: getUniqueInt(),
  trigger_source: TriggerSource.scheduler,
  created_at: getUniqueDate(),
  updated_at: getUniqueDate(),
});

const LOGGING_CTX = (item: ReturnType<typeof makeItem>) => ({ fn: 'ReviewRetriggerProbe', repo: item.repo_full_name, pr: item.pr_number, queueId: item.id });

describe('ReviewRetriggerProbe', () => {
  it('marks retriggered, records event, and logs on reviewRetriggered', async () => {
    const item = makeItem();
    const queue = { markRetriggered: jest.fn() } as unknown as jest.Mocked<QueueRepository>;
    const events = { record: jest.fn() } as unknown as jest.Mocked<EventRepository>;
    const observation = { correlationId: 'cid', requestId: 'rid', version: 'v1' } as ObservationContext;
    const logger = createMockLogger();
    const cooldownUntil = getUniqueDate();
    const retriggeredCommentUrl = 'https://gh/c/retriggered';
    const probe = new ReviewRetriggerProbe(item, queue, events, observation, logger);

    await probe.reviewRetriggered(retriggeredCommentUrl, cooldownUntil, TX);

    expect(queue.markRetriggered).toHaveBeenCalledWith(item.id, cooldownUntil, retriggeredCommentUrl, TX);
    expect(events.record).toHaveBeenCalledWith(
      {
        type: EventType.retriggered,
        repo_full_name: item.repo_full_name,
        pr_number: item.pr_number,
        correlation_id: 'cid',
        request_id: 'rid',
        version: 'v1',
        payload: {
          source_comment_url: item.source_comment_url,
          retriggered_comment_url: retriggeredCommentUrl,
        },
      },
      TX,
    );
    expect(logger.info).toHaveBeenCalledWith(LOGGING_CTX(item), 'Retrigger retriggered');
  });

  it('logs on staleCommentRescheduled', () => {
    const item = makeItem();
    const logger = createMockLogger();
    const notBefore = getUniqueDate();
    const probe = new ReviewRetriggerProbe(item, {} as any, {} as any, {} as any, logger);

    probe.staleCommentRescheduled(notBefore);

    expect(logger.info).toHaveBeenCalledWith({ ...LOGGING_CTX(item), notBefore }, 'Stale source comment replaced; cannot retrigger');
  });

  it('logs on staleCommentSkipped', () => {
    const item = makeItem();
    const logger = createMockLogger();
    const probe = new ReviewRetriggerProbe(item, {} as any, {} as any, {} as any, logger);

    probe.staleCommentSkipped();

    expect(logger.info).toHaveBeenCalledWith(LOGGING_CTX(item), 'No replacement rate-limit comment found; cannot retrigger');
  });

  it('logs on staleCommentReplacementDeleted', () => {
    const item = makeItem();
    const logger = createMockLogger();
    const REPLACEMENT_ID = 999;
    const probe = new ReviewRetriggerProbe(item, {} as any, {} as any, {} as any, logger);

    probe.staleCommentReplacementDeleted(REPLACEMENT_ID);

    expect(logger.info).toHaveBeenCalledWith(
      { ...LOGGING_CTX(item), replacementCommentId: REPLACEMENT_ID },
      'Replacement comment was deleted before fetch; cannot retrigger',
    );
  });
});
