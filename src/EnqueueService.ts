import type { PullRequestRepository } from './db/pullRequestRepository.js';
import type { QueueRepository } from './db/queueRepository.js';
import { classifyCoderabbitComment } from './github/classifyCoderabbitComment.js';
import type { PRStateFetcher } from './github/PRStateFetcher.js';
import { isPRClosedWithoutMerge, isPRMerged } from './github/prStateUtils.js';
import type { ObservationContextProvider } from './observability/observationContext.js';
import type { ProbeFactory } from './probes/ProbeFactory.js';
import { type OnDetectedCallback } from './types/index.js';
import { TYPES } from './inversify-types.js';

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
    @inject(TYPES.PRStateFetcher)
    private readonly fetcher: PRStateFetcher,
  ) {}
  /* c8 ignore stop */

  readonly handle: OnDetectedCallback = async (comment, waitSeconds) => {
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

    const prState = await this.fetcher.fetch(comment.repoFullName, comment.prNumber, 'EnqueueService.handle');

    await this.prisma.$transaction(async (tx) => {
      if (prState !== undefined && isPRMerged(prState)) {
        await probe.prMerged(tx);
      } else if (prState !== undefined && isPRClosedWithoutMerge(prState)) {
        await probe.prClosedWithoutMerge(tx);
      } else {
        const classification = classifyCoderabbitComment(comment.body);

        if (classification === 'review_skipped') {
          const existing = await this.queue.findBySourceCommentId(comment.commentId, tx);
          if (existing) {
            probe.alreadySkipped(existing.status);
            return;
          }
          const { id: pullRequestId } = await this.pullRequests.upsert(
            comment.repoFullName,
            comment.prNumber,
            { prTitle: comment.prTitle, reviewLimitAt: new Date() },
            tx,
          );
          await this.queue.createSkipped(
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
          await probe.skipped(tx);
          return;
        }

        const { id: pullRequestId } = await this.pullRequests.upsert(
          comment.repoFullName,
          comment.prNumber,
          { prTitle: comment.prTitle, reviewLimitAt: new Date() },
          tx,
        );
        const { created } = await this.queue.enqueue(
          {
            repo: comment.repoFullName,
            pr: comment.prNumber,
            prTitle: comment.prTitle,
            sourceCommentUrl: comment.url,
            sourceCommentId: comment.commentId,
            newWait: waitSeconds,
            pullRequestId,
          },
          obs,
          tx,
        );
        if (created) {
          await probe.enqueued(tx);
        } else {
          probe.alreadyQueued();
        }
      }
    });
  };
}
