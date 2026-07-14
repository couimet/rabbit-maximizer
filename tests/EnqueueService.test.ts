import type { QueueRepository } from '../src/db/queueRepository.js';
import { EnqueueService } from '../src/EnqueueService.js';
import type { PRStateFetcher } from '../src/github/PRStateFetcher.js';
import type { ObservationContextProvider } from '../src/observability/observationContext.js';
import type { DetectedProbe } from '../src/probes/DetectedProbe.js';
import type { ProbeFactory } from '../src/probes/ProbeFactory.js';
import type { DetectedComment } from '../src/types/DetectedComment.js';

import { createMockProbeFactory } from './helpers/createMockProbeFactory.js';
import { createMockDetectedProbe } from './helpers/createMockProbes.js';
import { createMockPullRequestRepo } from './helpers/index.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type Prisma, type PrismaClient } from '@prisma/client';

const MS_PER_SECOND = 1000;

const makeComment = (): DetectedComment => ({
  url: getUniqueString({ prefix: 'https://gh/c/' }),
  repo_full_name: getUniqueGitHubRepoRef().fullName,
  pr_number: getUniqueInt(),
  pr_title: 'Test PR title',
  comment_id: getUniqueInt(),
  created_at: getUniqueDate().toISOString(),
  updated_at: getUniqueDate().toISOString(),
});

describe('EnqueueService', () => {
  let queue: QueueRepository;
  let probes: ProbeFactory;
  let observation: ObservationContextProvider;
  let prisma: PrismaClient;
  let tx: Prisma.TransactionClient;
  let probe: {
    detected: jest.Mock;
    enqueued: jest.Mock;
    prMerged: jest.Mock;
    prClosedWithoutMerge: jest.Mock;
    alreadyQueued: jest.Mock;
  };
  let fetcher: PRStateFetcher;
  let mockPullRequests: ReturnType<typeof createMockPullRequestRepo>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-22T12:00:00Z'));
    mockPullRequests = createMockPullRequestRepo();

    queue = {
      enqueue: jest.fn<any>().mockResolvedValue({ item: {}, created: true }),
      markPosted: jest.fn(),
      markReviewed: jest.fn(),
      reschedule: jest.fn(),
      markFailed: jest.fn(),
      getPendingQueue: jest.fn(),
    } as unknown as QueueRepository;

    tx = {} as Prisma.TransactionClient;
    prisma = {
      $transaction: jest.fn<(fn: (client: Prisma.TransactionClient) => unknown) => unknown>().mockImplementation((fn) => fn(tx)),
    } as unknown as PrismaClient;

    probe = createMockDetectedProbe();
    probes = createMockProbeFactory({ createDetectedProbe: jest.fn().mockReturnValue(probe as unknown as DetectedProbe) });

    observation = {
      current: jest.fn().mockReturnValue({ correlationId: getUuid(), requestId: getUuid(), version: '1.0.0' }),
    } as unknown as ObservationContextProvider;

    fetcher = {
      fetch: jest.fn<any>().mockResolvedValue({ state: 'open', merged_at: null }),
    } as unknown as PRStateFetcher;
  });

  const createService = () => new EnqueueService(queue, mockPullRequests, prisma, probes, observation, fetcher);

  describe('handle', () => {
    it('bypasses via probe when PR is already merged', async () => {
      (fetcher.fetch as jest.Mock<any>).mockResolvedValue({ state: 'closed', merged_at: '2026-06-22T10:00:00Z' });
      const svc = createService();
      const comment = makeComment();

      await svc.handle(comment, 330);

      expect(probe.detected).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(probe.prMerged).toHaveBeenCalledWith(tx);
      expect(queue.enqueue).not.toHaveBeenCalled();
      expect(probe.enqueued).not.toHaveBeenCalled();
    });

    it('bypasses via probe when PR is closed without merge', async () => {
      (fetcher.fetch as jest.Mock<any>).mockResolvedValue({ state: 'closed', merged_at: null });
      const svc = createService();
      const comment = makeComment();

      await svc.handle(comment, 330);

      expect(probe.detected).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(probe.prClosedWithoutMerge).toHaveBeenCalledWith(tx);
      expect(queue.enqueue).not.toHaveBeenCalled();
      expect(probe.enqueued).not.toHaveBeenCalled();
    });

    it('creates probe, enqueues, and completes probe in a transaction when PR is open', async () => {
      const svc = createService();
      const comment = makeComment();
      const waitSeconds = 330;
      const pullRequestId = getUniqueInt();
      mockPullRequests.upsert.mockResolvedValue({ id: pullRequestId, created: true });
      const expectedScheduledFor = new Date(new Date(comment.updated_at).getTime() + waitSeconds * MS_PER_SECOND);

      await svc.handle(comment, waitSeconds);

      expect(probes.createDetectedProbe).toHaveBeenCalledWith(
        { repo_full_name: comment.repo_full_name, pr_number: comment.pr_number, source_ts: new Date(comment.created_at), source_comment_url: comment.url },
        observation.current(),
      );
      expect(probe.detected).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(queue.enqueue).toHaveBeenCalledWith(
        {
          repo: comment.repo_full_name,
          pr: comment.pr_number,
          prTitle: comment.pr_title,
          notBefore: expectedScheduledFor,
          sourceCommentUrl: comment.url,
          sourceCommentId: comment.comment_id,
          newWait: waitSeconds,
          pullRequestId,
        },
        observation.current(),
        tx,
      );
      expect(probe.enqueued).toHaveBeenCalledWith(tx);
      expect(probe.prMerged).not.toHaveBeenCalled();
    });

    it('proceeds with enqueue when getPRState fails', async () => {
      (fetcher.fetch as jest.Mock<any>).mockResolvedValue(undefined);
      const svc = createService();
      const comment = makeComment();
      const waitSeconds = 330;

      await svc.handle(comment, waitSeconds);

      expect(probe.detected).toHaveBeenCalled();
      expect(queue.enqueue).toHaveBeenCalled();
      expect(probe.enqueued).toHaveBeenCalledWith(tx);
      expect(probe.prMerged).not.toHaveBeenCalled();
    });

    it('skips enqueued when enqueue returns created: false', async () => {
      (queue.enqueue as jest.Mock<any>).mockResolvedValue({ item: {}, created: false });
      const svc = createService();
      const comment = makeComment();
      const waitSeconds = 330;

      await svc.handle(comment, waitSeconds);

      expect(probe.detected).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(queue.enqueue).toHaveBeenCalled();
      expect(probe.enqueued).not.toHaveBeenCalled();
      expect(probe.alreadyQueued).toHaveBeenCalled();
      expect(probe.prMerged).not.toHaveBeenCalled();
    });

    it('schedules the enqueue based on comment.updated_at and wait', async () => {
      const svc = createService();
      const comment = makeComment();
      const waitSeconds = 120;
      const pullRequestId = getUniqueInt();
      mockPullRequests.upsert.mockResolvedValue({ id: pullRequestId, created: true });
      const expectedScheduledFor = new Date(new Date(comment.updated_at).getTime() + waitSeconds * MS_PER_SECOND);

      await svc.handle(comment, waitSeconds);

      expect(queue.enqueue).toHaveBeenCalledWith(
        {
          repo: comment.repo_full_name,
          pr: comment.pr_number,
          prTitle: comment.pr_title,
          notBefore: expectedScheduledFor,
          sourceCommentUrl: comment.url,
          sourceCommentId: comment.comment_id,
          newWait: waitSeconds,
          pullRequestId,
        },
        observation.current(),
        tx,
      );
    });
  });
});
