import type { QueueRepository } from '../src/db/queueRepository.js';
import { EnqueueService } from '../src/EnqueueService.js';
import type { ObservationContextProvider } from '../src/observability/observationContext.js';
import type { DetectedProbe } from '../src/probes/DetectedProbe.js';
import type { ProbeFactory } from '../src/probes/ProbeFactory.js';
import type { RateLimitComment } from '../src/types/RateLimitComment.js';

import { getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type Prisma, type PrismaClient } from '@prisma/client';

const MS_PER_SECOND = 1000;

const makeComment = (): RateLimitComment => ({
  url: getUniqueString({ prefix: 'https://gh/c/' }),
  repo_full_name: `${getUniqueString({ prefix: 'org' })}/${getUniqueString({ prefix: 'repo' })}`,
  pr_number: getUniqueInt(),
  comment_id: getUniqueInt(),
  created_at: new Date().toISOString(),
});

describe('EnqueueService', () => {
  let queue: QueueRepository;
  let probes: ProbeFactory;
  let observation: ObservationContextProvider;
  let prisma: PrismaClient;
  let tx: Prisma.TransactionClient;
  let probe: { processStarted: jest.Mock; processCompleted: jest.Mock };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-22T12:00:00Z'));

    queue = {
      enqueue: jest.fn(),
      getNextDue: jest.fn(),
      markPosted: jest.fn(),
      markCompleted: jest.fn(),
      reschedule: jest.fn(),
      markFailed: jest.fn(),
      getPendingQueue: jest.fn(),
    } as unknown as QueueRepository;

    tx = {} as Prisma.TransactionClient;
    prisma = {
      $transaction: jest.fn<(fn: (client: Prisma.TransactionClient) => unknown) => unknown>().mockImplementation((fn) => fn(tx)),
    } as unknown as PrismaClient;

    probe = {
      processStarted: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      processCompleted: jest.fn<() => Promise<{ uuid: string }>>().mockResolvedValue({ uuid: getUniqueString() }),
    };
    probes = { createDetectedProbe: jest.fn().mockReturnValue(probe as unknown as DetectedProbe) } as unknown as ProbeFactory;

    observation = {
      current: jest
        .fn()
        .mockReturnValue({ correlationId: getUniqueString({ prefix: 'corr-' }), requestId: getUniqueString({ prefix: 'req-' }), version: '1.0.0' }),
    } as unknown as ObservationContextProvider;
  });

  describe('handle', () => {
    it('creates probe, calls processStarted, enqueues, and completes in a transaction', async () => {
      const svc = new EnqueueService(queue, prisma, probes, observation);
      const comment = makeComment();
      const jitteredWait = 330;

      await svc.handle(comment, jitteredWait);

      expect(probes.createDetectedProbe).toHaveBeenCalledWith(
        { repo_full_name: comment.repo_full_name, pr_number: comment.pr_number, source_ts: new Date(comment.created_at), source_comment_url: comment.url },
        observation.current(),
      );
      expect(probe.processStarted).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(queue.enqueue).toHaveBeenCalledWith(
        comment.repo_full_name,
        comment.pr_number,
        expect.any(Date),
        comment.url,
        jitteredWait,
        observation.current(),
        tx,
      );
      expect(probe.processCompleted).toHaveBeenCalledWith(tx);
    });

    it('schedules the enqueue for now + jittered wait', async () => {
      const svc = new EnqueueService(queue, prisma, probes, observation);
      const comment = makeComment();
      const jitteredWait = 120;

      await svc.handle(comment, jitteredWait);

      const enqueuedScheduledFor = (queue.enqueue as jest.Mock).mock.calls[0][2] as Date;
      const expectedTime = Date.now() + jitteredWait * MS_PER_SECOND;
      expect(Math.abs(enqueuedScheduledFor.getTime() - expectedTime)).toBeLessThan(MS_PER_SECOND);
    });
  });
});
