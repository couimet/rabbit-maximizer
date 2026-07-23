import type { PullRequestRepository, QueueRepository } from './db/index.js';
import { classifyCoderabbitComment } from './github/index.js';
import type { ObservationContextProvider } from './observability/index.js';
import type { ProbeFactory } from './probes/index.js';
import { type OnDetectedCallback } from './types/index.js';
import { TYPES } from './domain.js';

import { type PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';

@injectable()
export class EnqueueService {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.QueueRepository)
    private readonly queue: QueueRepository,
    @inject(TYPES.PullRequestRepository)
    private readonly pullRequests: PullRequestRepository,
    @inject(TYPES.PrismaClient)
    private readonly prisma: PrismaClient,
    @inject(TYPES.ProbeFactory)
    private readonly probes: ProbeFactory,
    @inject(TYPES.ObservationContextProvider)
    private readonly observation: ObservationContextProvider,
  ) {}
  /* c8 ignore stop */

  readonly handle: OnDetectedCallback = async (comment, pullRequestId) => {
    const obs = this.observation.current();

    const probe = this.probes.createDetectedProbe(
      {
        repo_full_name: comment.repoFullName,
        pr_number: comment.prNumber,
        source_ts: new Date(comment.createdAt),
        source_comment_url: comment.url,
      },
      obs,
    );
    await probe.detected();

    await this.prisma.$transaction(async (tx) => {
      await this.pullRequests.recordReviewLimitDetection(pullRequestId, new Date(), tx);

      const classification = classifyCoderabbitComment(comment.body);

      if (classification === 'review_skipped') {
        const { item, created } = await this.queue.createSkipped(
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
        if (created) {
          await probe.skipped(tx);
        } else {
          probe.alreadySkipped(item.status);
        }
        return;
      }

      const { created } = await this.queue.enqueue(
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
      if (created) {
        await probe.enqueued(tx);
      } else {
        probe.alreadyQueued();
      }
    });
  };
}
