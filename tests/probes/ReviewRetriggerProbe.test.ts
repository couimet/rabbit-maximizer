import type { EventRepository } from '../../src/db/index.js';
import { EventType } from '../../src/domain.js';
import type { ObservationContext } from '../../src/observability/index.js';
import { ReviewRetriggerProbe } from '../../src/probes/index.js';
import { type QueueItem } from '../../src/types/index.js';
import { createMockTx } from '../external-deps/couimet/prisma-testing/index.js';
import { createMockEventRepo, generateQueueItemHydrationData } from '../helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

const tx = createMockTx();

const loggingCtx = (item: QueueItem) => (fn: string) => ({ fn, repo: item.repo_full_name, pr: item.pr_number, queueId: item.id });

describe('ReviewRetriggerProbe', () => {
  let events: jest.Mocked<EventRepository>;
  let logger: ReturnType<typeof createMockLogger>;
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
    const item = generateQueueItemHydrationData();
    const cooldownUntil = getUniqueDate();
    const retriggeredCommentUrl = getUniqueString({ prefix: 'https://gh/c/' });

    const probe = createProbe(item);
    await probe.reviewRetriggered(retriggeredCommentUrl, cooldownUntil, tx);

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
      tx,
    );
    expect(logger.info).toHaveBeenCalledWith(loggingCtx(item)('ReviewRetriggerProbe.reviewRetriggered'), 'Review retriggered');
  });

  it('logs on staleCommentRescheduled', () => {
    const item = generateQueueItemHydrationData();
    const cooldownUntil = getUniqueDate();

    const probe = createProbe(item);
    probe.staleCommentRescheduled(cooldownUntil);

    expect(logger.info).toHaveBeenCalledWith(
      { ...loggingCtx(item)('ReviewRetriggerProbe.staleCommentRescheduled'), cooldownUntil },
      'Stale source comment replaced; rescheduled with updated cooldown time',
    );
  });

  it('logs on staleCommentSkipped', () => {
    const item = generateQueueItemHydrationData();

    const probe = createProbe(item);
    probe.staleCommentSkipped();

    expect(logger.warn).toHaveBeenCalledWith(loggingCtx(item)('ReviewRetriggerProbe.staleCommentSkipped'), 'No replacement rate-limit comment found');
  });

  it('logs on staleCommentReplacementDeleted', () => {
    const item = generateQueueItemHydrationData();
    const replacementId = getUniqueInt();

    const probe = createProbe(item);
    probe.staleCommentReplacementDeleted(replacementId);

    expect(logger.warn).toHaveBeenCalledWith(
      { ...loggingCtx(item)('ReviewRetriggerProbe.staleCommentReplacementDeleted'), commentId: replacementId },
      'Replacement comment was deleted before fetch',
    );
  });
});
