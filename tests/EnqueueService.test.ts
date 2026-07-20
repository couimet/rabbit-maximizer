import { EnqueueService } from '../src/EnqueueService.js';
import type { PRStateFetcher } from '../src/github/PRStateFetcher.js';
import type { ObservationContextProvider } from '../src/observability/observationContext.js';
import type { DetectedProbe } from '../src/probes/DetectedProbe.js';
import type { ProbeFactory } from '../src/probes/ProbeFactory.js';

import { createMockProbeFactory } from './helpers/createMockProbeFactory.js';
import { createMockDetectedProbe } from './helpers/createMockProbes.js';
import { createMockPullRequestRepo, createMockQueueRepo, makeDetectedComment } from './helpers/index.js';

import { getUniqueInt, getUuid } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type Prisma, type PrismaClient } from '@prisma/client';

const FOR_TEST_SKIP_BODY = 'skip review by coderabbit.ai';

describe('EnqueueService', () => {
  let queue: ReturnType<typeof createMockQueueRepo>;
  let probes: ProbeFactory;
  let observation: ObservationContextProvider;
  let prisma: PrismaClient;
  let tx: Prisma.TransactionClient;
  let probe: ReturnType<typeof createMockDetectedProbe>;
  let fetcher: PRStateFetcher;
  let mockPullRequests: ReturnType<typeof createMockPullRequestRepo>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-22T12:00:00Z'));
    mockPullRequests = createMockPullRequestRepo();
    queue = createMockQueueRepo({ enqueue: jest.fn<any>().mockResolvedValue({ item: {}, created: true }) });

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
      const comment = makeDetectedComment();

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
      const comment = makeDetectedComment();

      await svc.handle(comment, 330);

      expect(probe.detected).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(probe.prClosedWithoutMerge).toHaveBeenCalledWith(tx);
      expect(queue.enqueue).not.toHaveBeenCalled();
      expect(probe.enqueued).not.toHaveBeenCalled();
    });

    it('creates probe, enqueues, and completes probe in a transaction when PR is open', async () => {
      const svc = createService();
      const comment = makeDetectedComment();
      const waitSeconds = 330;
      const pullRequestId = getUniqueInt();
      mockPullRequests.upsert.mockResolvedValue({ id: pullRequestId, created: true });

      await svc.handle(comment, waitSeconds);

      expect(probes.createDetectedProbe).toHaveBeenCalledWith(
        { repo_full_name: comment.repoFullName, pr_number: comment.prNumber, source_ts: new Date(comment.createdAt), source_comment_url: comment.url },
        observation.current(),
      );
      expect(probe.detected).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(queue.enqueue).toHaveBeenCalledWith(
        {
          repo: comment.repoFullName,
          pr: comment.prNumber,
          prTitle: comment.prTitle,
          sourceCommentUrl: comment.url,
          sourceCommentId: comment.commentId,
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
      const comment = makeDetectedComment();
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
      const comment = makeDetectedComment();
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
      const comment = makeDetectedComment();
      const waitSeconds = 120;
      const pullRequestId = getUniqueInt();
      mockPullRequests.upsert.mockResolvedValue({ id: pullRequestId, created: true });

      await svc.handle(comment, waitSeconds);

      expect(queue.enqueue).toHaveBeenCalledWith(
        {
          repo: comment.repoFullName,
          pr: comment.prNumber,
          prTitle: comment.prTitle,
          sourceCommentUrl: comment.url,
          sourceCommentId: comment.commentId,
          newWait: waitSeconds,
          pullRequestId,
        },
        observation.current(),
        tx,
      );
    });

    describe('skip path', () => {
      it('creates skipped entry when comment classifies as review_skipped and PR is open', async () => {
        const svc = createService();
        const comment = makeDetectedComment({ body: FOR_TEST_SKIP_BODY });
        const pullRequestId = getUniqueInt();
        mockPullRequests.upsert.mockResolvedValue({ id: pullRequestId, created: true });

        await svc.handle(comment, 330);

        expect(probe.detected).toHaveBeenCalled();
        expect(queue.findBySourceCommentId).toHaveBeenCalledWith(comment.commentId, tx);
        expect(mockPullRequests.upsert).toHaveBeenCalledWith(
          comment.repoFullName,
          comment.prNumber,
          { prTitle: comment.prTitle, reviewLimitAt: new Date('2026-06-22T12:00:00Z') },
          tx,
        );
        expect(queue.createSkipped).toHaveBeenCalledWith(
          {
            repo: comment.repoFullName,
            pr: comment.prNumber,
            prTitle: comment.prTitle,
            sourceCommentUrl: comment.url,
            sourceCommentId: comment.commentId,
            pullRequestId,
          },
          tx,
        );
        expect(probe.skipped).toHaveBeenCalledWith(tx);
        expect(queue.enqueue).not.toHaveBeenCalled();
      });

      it('bypasses merged PR even when comment is review_skipped', async () => {
        (fetcher.fetch as jest.Mock<any>).mockResolvedValue({ state: 'closed', merged_at: '2026-06-22T10:00:00Z' });
        const svc = createService();
        const comment = makeDetectedComment({ body: FOR_TEST_SKIP_BODY });

        await svc.handle(comment, 330);

        expect(probe.prMerged).toHaveBeenCalledWith(tx);
        expect(queue.createSkipped).not.toHaveBeenCalled();
      });

      it('bypasses closed PR even when comment is review_skipped', async () => {
        (fetcher.fetch as jest.Mock<any>).mockResolvedValue({ state: 'closed', merged_at: null });
        const svc = createService();
        const comment = makeDetectedComment({ body: FOR_TEST_SKIP_BODY });

        await svc.handle(comment, 330);

        expect(probe.prClosedWithoutMerge).toHaveBeenCalledWith(tx);
        expect(queue.createSkipped).not.toHaveBeenCalled();
      });

      it('skips creating duplicate when comment was already recorded as skipped', async () => {
        (queue.findBySourceCommentId as jest.Mock<any>).mockResolvedValue({ status: 'coderabbit_skipped' });
        const svc = createService();
        const comment = makeDetectedComment({ body: FOR_TEST_SKIP_BODY });

        await svc.handle(comment, 330);

        expect(probe.alreadySkipped).toHaveBeenCalledWith('coderabbit_skipped');
        expect(queue.createSkipped).not.toHaveBeenCalled();
        expect(probe.skipped).not.toHaveBeenCalled();
      });
    });
  });
});
