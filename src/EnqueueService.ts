import type { CoderabbitCommentRepository, PullRequestRepository, QueueRepository, UpsertCommentData } from './db/index.js';
import { classifyCoderabbitComment, parseWaitSeconds } from './github/index.js';
import type { ProbeFactory } from './probes/index.js';
import { type OnDetectedCallback } from './types/index.js';
import { extractCoderabbitRunId, isReviewVerdictState, MS_PER_SECOND } from './utils/index.js';
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
  ) {}
  /* c8 ignore stop */

  readonly handle: OnDetectedCallback = async (comment, pullRequestId) => {
    const coderabbitRunId = extractCoderabbitRunId(comment.body);

    const probe = this.probes.createDetectedProbe({
      repo_full_name: comment.repoFullName,
      pr_number: comment.prNumber,
      source_ts: new Date(comment.createdAt),
      source_comment_url: comment.url,
      coderabbit_run_id: coderabbitRunId,
    });
    await probe.detected();

    const { classification } = classifyCoderabbitComment(comment.body);
    const commentData: UpsertCommentData = {
      comment_id: comment.commentId,
      pull_request_id: pullRequestId,
      url: comment.url,
      comment_type: classification,
      body: comment.body,
      gh_created_at: new Date(comment.createdAt),
      gh_updated_at: new Date(comment.updatedAt),
      coderabbit_run_id: coderabbitRunId ?? null,
    };

    // A completed review only dismisses comments from runs it already saw. CodeRabbit
    // edits its comment in place per push, so an edit newer than the recorded verdict
    // is a new run and must flow through the normal branches.
    const existingReview = await this.coderabbitComments.findCompletedReview(pullRequestId);
    if (existingReview && new Date(comment.updatedAt) <= existingReview.gh_updated_at) {
      await this.prisma.$transaction(async (tx) => {
        // Latch last_seen_at even when dismissing, or the DirectCommentChecker
        // freshness gate re-detects this comment on every scan.
        await this.coderabbitComments.upsert(commentData, tx);
      });
      probe.alreadyReviewed(existingReview);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await this.pullRequests.recordReviewLimitDetection(pullRequestId, new Date(), tx);
      await this.coderabbitComments.upsert(commentData, tx);

      if (classification === 'review_skipped') {
        const { created } = await this.queue.enqueue(
          {
            repo: comment.repoFullName,
            pr: comment.prNumber,
            prTitle: comment.prTitle,
            sourceCommentUrl: comment.url,
            sourceCommentId: comment.commentId,
            coderabbitRunId,
            commentUpdatedAt: new Date(comment.updatedAt),
            cooldownUntil: undefined,
            pullRequestId,
          },
          tx,
        );
        if (created) {
          await probe.enqueued(tx);
        } else {
          probe.alreadyQueued();
        }
        await probe.skipped(tx);
        return;
      }

      if (isReviewVerdictState(classification)) {
        await this.pullRequests.recordReview(pullRequestId, comment.url, classification, undefined, tx);
        await probe.verdictResolved(tx, classification);
        return;
      }

      const waitSeconds = parseWaitSeconds(comment.body);
      const effectiveWait = (waitSeconds ?? config.REVIEW_LIMIT_FALLBACK_WAIT_SEC) * MS_PER_SECOND;
      const cooldownUntil = new Date(new Date(comment.updatedAt).getTime() + effectiveWait);

      const { created } = await this.queue.enqueue(
        {
          repo: comment.repoFullName,
          pr: comment.prNumber,
          prTitle: comment.prTitle,
          sourceCommentUrl: comment.url,
          sourceCommentId: comment.commentId,
          coderabbitRunId,
          commentUpdatedAt: new Date(comment.updatedAt),
          cooldownUntil,
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
