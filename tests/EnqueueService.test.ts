import type { QueueRepository } from '../src/db/queueRepository.js';
import { EnqueueService } from '../src/EnqueueService.js';
import type { PRStateFetcher } from '../src/github/PRStateFetcher.js';
import type { ObservationContextProvider } from '../src/observability/observationContext.js';
import type { DetectedProbe } from '../src/probes/DetectedProbe.js';
import type { ProbeFactory } from '../src/probes/ProbeFactory.js';
import type { RateLimitComment } from '../src/types/RateLimitComment.js';

import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type Prisma, type PrismaClient } from '@prisma/client';

const MS_PER_SECOND = 1000;

const makeComment = (): RateLimitComment => ({
  url: getUniqueString({ prefix: 'https://gh/c/' }),
  repo_full_name: `${getUniqueString({ prefix: 'org' })}/${getUniqueString({ prefix: 'repo' })}`,
  pr_number: getUniqueInt(),
  comment_id: getUniqueInt(),
  created_at: getUniqueDate().toISOString(),
});

describe('EnqueueService', () => {
  let queue: QueueRepository;
  let probes: ProbeFactory;
  let observation: ObservationContextProvider;
  let prisma: PrismaClient;
  let tx: Prisma.TransactionClient;
  let probe: { processStarted: jest.Mock; processCompleted: jest.Mock; processMerged: jest.Mock; processClosedWithoutMerge: jest.Mock };
  let fetcher: PRStateFetcher;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-22T12:00:00Z'));

    queue = {
      enqueue: jest.fn(),
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
      processMerged: jest.fn<() => Promise<{ uuid: string }>>().mockResolvedValue({ uuid: getUniqueString() }),
      processClosedWithoutMerge: jest.fn<() => Promise<{ uuid: string }>>().mockResolvedValue({ uuid: getUniqueString() }),
    };
    probes = { createDetectedProbe: jest.fn().mockReturnValue(probe as unknown as DetectedProbe) } as unknown as ProbeFactory;

    observation = {
      current: jest
        .fn()
        .mockReturnValue({ correlationId: getUniqueString({ prefix: 'corr-' }), requestId: getUniqueString({ prefix: 'req-' }), version: '1.0.0' }),
    } as unknown as ObservationContextProvider;

    fetcher = {
      fetch: jest.fn<any>().mockResolvedValue({ state: 'open', merged_at: null }),
    } as unknown as PRStateFetcher;
  });

  const createService = () => new EnqueueService(queue, prisma, probes, observation, fetcher);

  describe('handle', () => {
    it('bypasses via probe when PR is already merged', async () => {
      (fetcher.fetch as jest.Mock<any>).mockResolvedValue({ state: 'closed', merged_at: '2026-06-22T10:00:00Z' });
      const svc = createService();
      const comment = makeComment();

      await svc.handle(comment, 330);

      expect(probe.processStarted).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(probe.processMerged).toHaveBeenCalledWith(tx);
      expect(queue.enqueue).not.toHaveBeenCalled();
      expect(probe.processCompleted).not.toHaveBeenCalled();
    });

    it('bypasses via probe when PR is closed without merge', async () => {
      (fetcher.fetch as jest.Mock<any>).mockResolvedValue({ state: 'closed', merged_at: null });
      const svc = createService();
      const comment = makeComment();

      await svc.handle(comment, 330);

      expect(probe.processStarted).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(probe.processClosedWithoutMerge).toHaveBeenCalledWith(tx);
      expect(queue.enqueue).not.toHaveBeenCalled();
      expect(probe.processCompleted).not.toHaveBeenCalled();
    });

    it('creates probe, enqueues, and completes probe in a transaction when PR is open', async () => {
      const svc = createService();
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
      expect(probe.processMerged).not.toHaveBeenCalled();
    });

    it('proceeds with enqueue when getPRState fails', async () => {
      (fetcher.fetch as jest.Mock<any>).mockResolvedValue(undefined);
      const svc = createService();
      const comment = makeComment();
      const jitteredWait = 330;

      await svc.handle(comment, jitteredWait);

      expect(probe.processStarted).toHaveBeenCalled();
      expect(queue.enqueue).toHaveBeenCalled();
      expect(probe.processCompleted).toHaveBeenCalledWith(tx);
      expect(probe.processMerged).not.toHaveBeenCalled();
    });

    it('schedules the enqueue for now + jittered wait', async () => {
      const svc = createService();
      const comment = makeComment();
      const jitteredWait = 120;

      await svc.handle(comment, jitteredWait);

      const enqueuedScheduledFor = (queue.enqueue as jest.Mock).mock.calls[0][2] as Date;
      const expectedTime = Date.now() + jitteredWait * MS_PER_SECOND;
      expect(Math.abs(enqueuedScheduledFor.getTime() - expectedTime)).toBeLessThan(MS_PER_SECOND);
    });
  });
});
