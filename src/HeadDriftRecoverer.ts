import type { PullRequestRepository, QueueRepository } from './db/index.js';
import { buildPrUrl, type CoderabbitGitHubClient, parseGitHubRateLimitError, splitRepo } from './github/index.js';
import type { HeadDriftProbe, ProbeFactory } from './probes/index.js';
import type { UnreviewedHeadPR } from './types/index.js';
import { CodeRabbitCommentType } from './domain.js';
import type { IgnoreRules } from './IgnoreRules.js';
import { TYPES } from './server-domain.js';

import type { Logger } from '@couimet/logger-contract';
import type { PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';

/**
 * Recovers a PR whose head commit no review covers, after a push that CodeRabbit left
 * unanswered. The sweep enqueues a pending item and lets the scheduler post the retrigger
 * under the existing holds. It never posts a request itself.
 */
@injectable()
export class HeadDriftRecoverer {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.PullRequestRepository)
    private readonly pullRequests: PullRequestRepository,
    @inject(TYPES.QueueRepository)
    private readonly queue: QueueRepository,
    @inject(TYPES.CoderabbitGitHubClient)
    private readonly github: CoderabbitGitHubClient,
    @inject(TYPES.IgnoreRules)
    private readonly ignoreRules: IgnoreRules,
    @inject(TYPES.PrismaClient)
    private readonly prisma: PrismaClient,
    @inject(TYPES.ProbeFactory)
    private readonly probes: ProbeFactory,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  /** `graceBound` is the newest head observation that still waits for the comment-driven path. */
  async recover(graceBound: Date): Promise<void> {
    const candidates = await this.pullRequests.findUnreviewedHeadPRs(graceBound);
    const probe = this.probes.createHeadDriftProbe();
    if (candidates.length === 0) {
      probe.noDriftFound();
      return;
    }

    for (const candidate of candidates) {
      probe.withCandidate(candidate);
      // The sweep calls the queue directly, so the rules that EnqueueService applies must run here.
      const ignoreMatch = this.ignoreRules.match({ authorLogin: candidate.authorLogin, title: candidate.title });
      if (ignoreMatch !== undefined) {
        probe.excluded(ignoreMatch);
        continue;
      }

      try {
        await this.recoverCandidate(candidate, probe);
      } catch (err) {
        // A rate limit must hold the whole tick, so the per-candidate catch cannot swallow it.
        if (parseGitHubRateLimitError(err) !== undefined) {
          throw err;
        }
        this.log.warn(
          { fn: 'HeadDriftRecoverer.recover', repoFullName: candidate.repoFullName, prNumber: candidate.prNumber, prId: candidate.id, error: err },
          'Failed to recover an unreviewed head; will retry next tick',
        );
      }
    }
  }

  private async recoverCandidate(candidate: UnreviewedHeadPR, probe: HeadDriftProbe): Promise<void> {
    const { owner, repo } = splitRepo(candidate.repoFullName);
    const review = await this.github.findCompletedReview(owner, repo, candidate.prNumber, candidate.headCommittedAt, undefined, candidate.headSha);

    if (review !== undefined) {
      const verdictState = review.isApproval ? CodeRabbitCommentType.review_approved : CodeRabbitCommentType.review_changes_suggested;
      await this.prisma.$transaction(async (tx) => {
        await this.pullRequests.recordReview(candidate.id, review.htmlUrl, verdictState, review.commitId, tx);
      });
      probe.headAlreadyReviewed(review.htmlUrl);
      return;
    }

    probe.headDriftFound();
    await this.prisma.$transaction(async (tx) => {
      const { created } = await this.queue.enqueue(
        {
          repo: candidate.repoFullName,
          pr: candidate.prNumber,
          prTitle: candidate.title,
          sourceCommentUrl: buildPrUrl(candidate.repoFullName, candidate.prNumber),
          sourceCommentId: -Date.now(),
          coderabbitRunId: undefined,
          cooldownUntil: undefined,
          sourceCommentType: undefined,
          pullRequestId: candidate.id,
        },
        tx,
      );
      if (created) {
        await probe.recovered(tx);
      }
    });
  }
}
