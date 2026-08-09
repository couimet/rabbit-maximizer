import type { CoderabbitCommentRepository, PullRequestRepository, QueueRepository } from './db/index.js';
import { classifyCoderabbitComment, parseWaitSeconds } from './github/index.js';
import type { ObservationContextProvider } from './observability/index.js';
import type { ProbeFactory } from './probes/index.js';
import { type OnDetectedCallback } from './types/index.js';
import { isReviewVerdictState, MS_PER_SECOND } from './utils/index.js';
import { config } from './config.js';
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
    @inject(TYPES.CoderabbitCommentRepository)
    private readonly coderabbitComments: CoderabbitCommentRepository,
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

    const existingReview = await this.coderabbitComments.findCompletedReview(pullRequestId);
    if (existingReview) {
      probe.alreadyReviewed(existingReview);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await this.pullRequests.recordReviewLimitDetection(pullRequestId, new Date(), tx);

      const classification = classifyCoderabbitComment(comment.body);

      await this.coderabbitComments.upsert(
        {
          comment_id: comment.commentId,
          pull_request_id: pullRequestId,
          url: comment.url,
          comment_type: classification,
          body: comment.body,
          gh_created_at: new Date(comment.createdAt),
          gh_updated_at: new Date(comment.updatedAt),
        },
        tx,
      );

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

      if (isReviewVerdictState(classification)) {
        await this.pullRequests.recordReview(pullRequestId, comment.url, classification, tx);
        await probe.verdictResolved(tx, classification);
        return;
      }

      const waitSeconds = parseWaitSeconds(comment.body);
      const effectiveWait = (waitSeconds ?? config.REVIEW_LIMIT_FALLBACK_WAIT_SEC) * MS_PER_SECOND;
      const notBefore = new Date(new Date(comment.updatedAt).getTime() + effectiveWait);

      const { created } = await this.queue.enqueue(
        {
          repo: comment.repoFullName,
          pr: comment.prNumber,
          prTitle: comment.prTitle,
          sourceCommentUrl: comment.url,
          sourceCommentId: comment.commentId,
          commentUpdatedAt: new Date(comment.updatedAt),
          notBefore,
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
