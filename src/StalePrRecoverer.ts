import type { PullRequestRepository } from './db/index.js';
import { buildPrUrl, CodeRabbitCommentType } from './github/index.js';
import type { OnDetectedCallback, StaleOpenPR } from './types/index.js';
import { TYPES } from './domain.js';

import type { Logger } from '@couimet/logger-contract';
import { inject, injectable } from 'inversify';

export interface StalePrRecoverer {
  recover(): Promise<StaleOpenPR[]>;
}

@injectable()
export class StalePrRecovererImpl implements StalePrRecoverer {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.PullRequestRepository)
    private readonly pullRequests: PullRequestRepository,
    @inject(TYPES.OnDetectedCallback)
    private readonly onDetected: OnDetectedCallback,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  async recover(): Promise<StaleOpenPR[]> {
    const stalePRs = await this.pullRequests.findStaleOpenPRs();
    if (stalePRs.length === 0) {
      return [];
    }

    this.log.warn({ fn: 'StalePrRecoverer.recover', count: stalePRs.length }, 'Recovering stale open PRs with no review-limit comment');
    const now = new Date().toISOString();
    for (const pr of stalePRs) {
      const syntheticComment = {
        url: buildPrUrl(pr.repoFullName, pr.prNumber),
        repoFullName: pr.repoFullName,
        prNumber: pr.prNumber,
        commentId: -Date.now(),
        createdAt: now,
        updatedAt: now,
        prTitle: pr.title,
        body: 'rate limited by coderabbit.ai — recovered from deleted comment',
        commentType: CodeRabbitCommentType.review_limited,
      };
      try {
        await this.onDetected(syntheticComment, pr.id);
      } catch (err) {
        this.log.warn(
          { fn: 'StalePrRecoverer.recover', repoFullName: pr.repoFullName, prNumber: pr.prNumber, prId: pr.id, error: err },
          'Failed to recover stale PR; will retry next tick',
        );
      }
    }
    return stalePRs;
  }
}
