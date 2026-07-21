import { EnqueueService } from '../src/EnqueueService.js';
import type { ObservationContextProvider } from '../src/observability/observationContext.js';
import type { DetectedProbe } from '../src/probes/DetectedProbe.js';
import type { ProbeFactory } from '../src/probes/ProbeFactory.js';

import { createMockProbeFactory } from './helpers/createMockProbeFactory.js';
import { createMockDetectedProbe } from './helpers/createMockProbes.js';
import { createMockPullRequestRepo, createMockQueueRepo, generateDetectedCommentHydrationData } from './helpers/index.js';

import { getUniqueDate, getUniqueInt, getUuid } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type Prisma, type PrismaClient } from '@prisma/client';

const FOR_TEST_SKIP_BODY = 'skip review by coderabbit.ai';

describe('EnqueueService', () => {
  let frozenNow: Date;
  let queue: ReturnType<typeof createMockQueueRepo>;
  let probes: ProbeFactory;
  let observation: ObservationContextProvider;
  let prisma: PrismaClient;
  let tx: Prisma.TransactionClient;
  let probe: ReturnType<typeof createMockDetectedProbe>;
  let mockPullRequests: ReturnType<typeof createMockPullRequestRepo>;

  beforeEach(() => {
    jest.useFakeTimers();
    frozenNow = getUniqueDate();
    jest.setSystemTime(frozenNow);
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
  });

  const createService = () => new EnqueueService(queue, mockPullRequests, prisma, probes, observation);

  describe('handle', () => {
    it('bypasses via probe when PR is not yet registered by the scanner', async () => {
      mockPullRequests.findByRepoAndPr.mockResolvedValue(null);
      const svc = createService();
      const comment = generateDetectedCommentHydrationData();

      await svc.handle(comment, 330);

      expect(probe.detected).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPullRequests.findByRepoAndPr).toHaveBeenCalledWith(comment.repoFullName, comment.prNumber, tx);
      expect(probe.prNotRegistered).toHaveBeenCalledWith(tx);
      expect(queue.enqueue).not.toHaveBeenCalled();
      expect(probe.enqueued).not.toHaveBeenCalled();
    });

    it('creates probe, enqueues, and completes probe in a transaction when PR is found', async () => {
      const svc = createService();
      const comment = generateDetectedCommentHydrationData();
      const waitSeconds = 330;
      const pullRequestId = getUniqueInt();
      mockPullRequests.findByRepoAndPr.mockResolvedValue({ id: pullRequestId });

      await svc.handle(comment, waitSeconds);

      expect(probes.createDetectedProbe).toHaveBeenCalledWith(
        { repo_full_name: comment.repoFullName, pr_number: comment.prNumber, source_ts: new Date(comment.createdAt), source_comment_url: comment.url },
        observation.current(),
      );
      expect(probe.detected).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPullRequests.findByRepoAndPr).toHaveBeenCalledWith(comment.repoFullName, comment.prNumber, tx);
      expect(mockPullRequests.recordReviewLimitDetection).toHaveBeenCalledWith(pullRequestId, frozenNow, tx);
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
      expect(probe.prNotRegistered).not.toHaveBeenCalled();
    });

    it('skips enqueued when enqueue returns created: false', async () => {
      (queue.enqueue as jest.Mock<any>).mockResolvedValue({ item: {}, created: false });
      const svc = createService();
      const comment = generateDetectedCommentHydrationData();
      const waitSeconds = 330;
      const pullRequestId = getUniqueInt();
      mockPullRequests.findByRepoAndPr.mockResolvedValue({ id: pullRequestId });

      await svc.handle(comment, waitSeconds);

      expect(probe.detected).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(queue.enqueue).toHaveBeenCalled();
      expect(probe.enqueued).not.toHaveBeenCalled();
      expect(probe.alreadyQueued).toHaveBeenCalled();
      expect(probe.prNotRegistered).not.toHaveBeenCalled();
    });

    it('schedules the enqueue based on comment.updated_at and wait', async () => {
      const svc = createService();
      const comment = generateDetectedCommentHydrationData();
      const waitSeconds = 120;
      const pullRequestId = getUniqueInt();
      mockPullRequests.findByRepoAndPr.mockResolvedValue({ id: pullRequestId });

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
      it('creates skipped entry when comment classifies as review_skipped and PR is found', async () => {
        const svc = createService();
        const comment = generateDetectedCommentHydrationData({ body: FOR_TEST_SKIP_BODY });
        const pullRequestId = getUniqueInt();
        mockPullRequests.findByRepoAndPr.mockResolvedValue({ id: pullRequestId });
        (queue.createSkipped as jest.Mock<any>).mockResolvedValue({ item: {}, created: true });

        await svc.handle(comment, 330);

        expect(probe.detected).toHaveBeenCalled();
        expect(mockPullRequests.findByRepoAndPr).toHaveBeenCalledWith(comment.repoFullName, comment.prNumber, tx);
        expect(mockPullRequests.recordReviewLimitDetection).toHaveBeenCalledWith(pullRequestId, frozenNow, tx);
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

      it('calls alreadySkipped when createSkipped returns created: false', async () => {
        (queue.createSkipped as jest.Mock<any>).mockResolvedValue({ item: { status: 'coderabbit_skipped' }, created: false });
        const svc = createService();
        const comment = generateDetectedCommentHydrationData({ body: FOR_TEST_SKIP_BODY });
        const pullRequestId = getUniqueInt();
        mockPullRequests.findByRepoAndPr.mockResolvedValue({ id: pullRequestId });

        await svc.handle(comment, 330);

        expect(probe.alreadySkipped).toHaveBeenCalledWith('coderabbit_skipped');
        expect(probe.skipped).not.toHaveBeenCalled();
      });
    });
  });
});
