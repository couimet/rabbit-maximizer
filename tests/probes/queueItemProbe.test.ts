import type { EventRepository } from '../../src/db/eventRepository.js';
import type { QueueRepository } from '../../src/db/queueRepository.js';
import type { ObservationContext } from '../../src/observability/observationContext.js';
import { QueueItemProbe } from '../../src/probes/QueueItemProbe.js';
import type { QueueItem } from '../../src/types/index.js';
import { createMockLogger, makeUniqueRepoName } from '../helpers/index.js';

import { getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Prisma } from '@prisma/client';

const makeTx = (): Prisma.TransactionClient => ({}) as Prisma.TransactionClient;

const makeItem = (repo: string, pr: number): QueueItem =>
  ({ id: getUniqueInt(), repo_full_name: repo, pr_number: pr, source_comment_url: getUniqueString({ prefix: 'https://gh/c/' }) }) as unknown as QueueItem;

describe('QueueItemProbe', () => {
  let queue: QueueRepository;
  let events: EventRepository;
  let logger: Logger;
  let observation: ObservationContext;

  beforeEach(() => {
    queue = {
      markCompleted: jest.fn<any>(),
      markFailed: jest.fn<any>(),
      markRetriggered: jest.fn<any>(),
    } as unknown as QueueRepository;

    events = {
      record: jest.fn<any>(),
    } as unknown as EventRepository;

    logger = createMockLogger();

    observation = {
      correlationId: getUniqueString({ prefix: 'corr-' }),
      requestId: getUniqueString({ prefix: 'req-' }),
      version: '1.0.0',
    };
  });

  const createProbe = (item: QueueItem) => new QueueItemProbe(item, queue, events, observation, logger);

  describe('processMergedBeforeRetrigger', () => {
    it('marks completed, records bypassed event, and logs', async () => {
      const { fullName: repo } = makeUniqueRepoName();
      const pr = getUniqueInt();
      const item = makeItem(repo, pr);
      const tx = makeTx();

      const probe = createProbe(item);
      await probe.processMergedBeforeRetrigger(tx);

      expect(queue.markCompleted).toHaveBeenCalledWith(item.id, tx);
      expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
        {
          type: 'bypassed',
          repo_full_name: repo,
          pr_number: pr,
          correlation_id: observation.correlationId,
          request_id: observation.requestId,
          version: observation.version,
          payload: { reason: 'prMerged' },
        },
        tx,
      );
      expect(logger.info as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'QueueItemProbe.processMergedBeforeRetrigger', repo, pr, queueId: item.id },
        'Merged before retrigger; marked completed',
      );
    });
  });

  describe('processClosedBeforeRetrigger', () => {
    it('marks failed, records bypassed event, and logs', async () => {
      const { fullName: repo } = makeUniqueRepoName();
      const pr = getUniqueInt();
      const item = makeItem(repo, pr);
      const tx = makeTx();

      const probe = createProbe(item);
      await probe.processClosedBeforeRetrigger(tx);

      expect(queue.markFailed).toHaveBeenCalledWith(item.id, tx);
      expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
        {
          type: 'bypassed',
          repo_full_name: repo,
          pr_number: pr,
          correlation_id: observation.correlationId,
          request_id: observation.requestId,
          version: observation.version,
          payload: { reason: 'prClosedWithoutMerge' },
        },
        tx,
      );
      expect(logger.info as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'QueueItemProbe.processClosedBeforeRetrigger', repo, pr, queueId: item.id },
        'PR closed before retrigger; marked failed',
      );
    });
  });

  describe('processRetriggered', () => {
    it('marks retriggered, records retriggered event, and logs', async () => {
      const { fullName: repo } = makeUniqueRepoName();
      const pr = getUniqueInt();
      const item = makeItem(repo, pr);
      const retriggeredCommentUrl = getUniqueString({ prefix: 'https://gh/c/posted-' });
      const cooldownUntil = new Date('2026-07-04T00:00:00Z');
      const tx = makeTx();

      const probe = createProbe(item);
      await probe.processRetriggered(retriggeredCommentUrl, cooldownUntil, tx);

      expect(queue.markRetriggered).toHaveBeenCalledWith(item.id, cooldownUntil, retriggeredCommentUrl, tx);
      expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
        {
          type: 'retriggered',
          repo_full_name: repo,
          pr_number: pr,
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
      expect(logger.info as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'QueueItemProbe.processRetriggered', repo, pr, queueId: item.id },
        'Retrigger retriggered',
      );
    });
  });
});
