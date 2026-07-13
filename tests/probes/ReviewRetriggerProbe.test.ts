import type { EventRepository } from '../../src/db/eventRepository.js';
import type { QueueRepository } from '../../src/db/queueRepository.js';
import type { ObservationContext } from '../../src/observability/observationContext.js';
import { ReviewRetriggerProbe } from '../../src/probes/ReviewRetriggerProbe.js';
import { EventType, QueueStatus, TriggerSource } from '../../src/types/index.js';
import { createMockEventRepo, createMockPullRequestRepo, createMockQueueRepo } from '../helpers/index.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Prisma } from '@prisma/client';

const TX = {} as Prisma.TransactionClient;

const makeItem = () => ({
  id: getUniqueInt(),
  uuid: getUuid(),
  repo_full_name: getUniqueGitHubRepoRef().fullName,
  pr_number: getUniqueInt(),
  status: QueueStatus.pending,
  not_before: getUniqueDate(),
  attempts: 0,
  pr_title: getUniqueString({ prefix: 'PR title ' }),
  source_comment_url: getUniqueString({ prefix: 'https://gh/c/' }),
  source_comment_id: getUniqueInt(),
  trigger_source: TriggerSource.scheduler,
  pull_request_id: getUniqueInt(),
  created_at: getUniqueDate(),
  updated_at: getUniqueDate(),
});

const LOGGING_CTX = (item: ReturnType<typeof makeItem>) => ({ fn: 'ReviewRetriggerProbe', repo: item.repo_full_name, pr: item.pr_number, queueId: item.id });

describe('ReviewRetriggerProbe', () => {
  let queue: jest.Mocked<QueueRepository>;
  let events: jest.Mocked<EventRepository>;
  let logger: Logger;
  let pullRequests: ReturnType<typeof createMockPullRequestRepo>;
  let observation: ObservationContext;

  beforeEach(() => {
    queue = createMockQueueRepo();
    events = createMockEventRepo();
    logger = createMockLogger();
    pullRequests = createMockPullRequestRepo();
    observation = {
      correlationId: getUuid(),
      requestId: getUuid(),
      version: getUniqueString({ prefix: 'v' }),
    };
  });

  const createProbe = (item: ReturnType<typeof makeItem>) => new ReviewRetriggerProbe(item, queue, pullRequests, events, observation, logger);

  it('marks retriggered, records event, and logs on reviewRetriggered', async () => {
    const item = makeItem();
    const cooldownUntil = getUniqueDate();
    const retriggeredCommentUrl = getUniqueString({ prefix: 'https://gh/c/' });

    const probe = createProbe(item);
    await probe.reviewRetriggered(retriggeredCommentUrl, cooldownUntil, TX);

    expect(queue.markRetriggered).toHaveBeenCalledWith(item.id, cooldownUntil, retriggeredCommentUrl, TX);
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
    expect(logger.info).toHaveBeenCalledWith(LOGGING_CTX(item), 'Retrigger retriggered');
  });

  it('logs on staleCommentRescheduled', () => {
    const item = makeItem();
    const notBefore = getUniqueDate();

    const probe = createProbe(item);
    probe.staleCommentRescheduled(notBefore);

    expect(logger.info).toHaveBeenCalledWith({ ...LOGGING_CTX(item), notBefore }, 'Stale source comment replaced; cannot retrigger');
  });

  it('logs on staleCommentSkipped', () => {
    const item = makeItem();

    const probe = createProbe(item);
    probe.staleCommentSkipped();

    expect(logger.info).toHaveBeenCalledWith(LOGGING_CTX(item), 'No replacement rate-limit comment found; cannot retrigger');
  });

  it('logs on staleCommentReplacementDeleted', () => {
    const item = makeItem();
    const REPLACEMENT_ID = getUniqueInt();

    const probe = createProbe(item);
    probe.staleCommentReplacementDeleted(REPLACEMENT_ID);

    expect(logger.info).toHaveBeenCalledWith(
      { ...LOGGING_CTX(item), replacementCommentId: REPLACEMENT_ID },
      'Replacement comment was deleted before fetch; cannot retrigger',
    );
  });
});
