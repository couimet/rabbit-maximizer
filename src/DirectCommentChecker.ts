import type { CoderabbitCommentRepository } from './db/index.js';
import {
  buildCommentUrl,
  classifyCoderabbitComment,
  type CoderabbitGitHubClient,
  hasOwnRetriggerMarker,
  parseWaitSeconds,
  REVIEW_BOT_LOGIN,
  splitRepo,
} from './github/index.js';
import type { DirectCheckPR, OnDetectedCallback, ReviewLimitCandidate } from './types/index.js';
import { CodeRabbitCommentType, TYPES } from './domain.js';

import type { Logger, LoggingContext } from '@couimet/logger-contract';
import { inject, injectable } from 'inversify';

const MAX_DIRECT_CHECK_PRS = 125;

export interface DirectCommentChecker {
  check(prs: readonly DirectCheckPR[]): Promise<ReviewLimitCandidate[]>;
}

@injectable()
export class DirectCommentCheckerImpl implements DirectCommentChecker {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.CoderabbitGitHubClient)
    private readonly github: CoderabbitGitHubClient,
    @inject(TYPES.OnDetectedCallback)
    private readonly onDetected: OnDetectedCallback,
    @inject(TYPES.CoderabbitCommentRepository)
    private readonly coderabbitComments: CoderabbitCommentRepository,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  /**
   * Check known PRs directly for rate-limit comments via the comments API, bypassing
   * GitHub search indexing delay. At ~21 open PRs and ~90s tick interval this adds
   * ~840 API calls/hr, well under the 5000/hr authenticated rate limit. Revisit if
   * the monitored PR count grows past ~125.
   */
  async check(prs: readonly DirectCheckPR[]): Promise<ReviewLimitCandidate[]> {
    const logCtx: LoggingContext = { fn: 'DirectCommentChecker.check' };
    const candidates: ReviewLimitCandidate[] = [];
    let found = 0;

    let effectivePRs: typeof prs;
    if (prs.length > MAX_DIRECT_CHECK_PRS) {
      this.log.warn(
        { ...logCtx, prCount: prs.length, maxDirectCheckPRs: MAX_DIRECT_CHECK_PRS },
        'PR count exceeds direct-check limit; truncating to prevent API rate-limit exhaustion',
      );
      effectivePRs = prs.slice(0, MAX_DIRECT_CHECK_PRS);
    } else {
      effectivePRs = prs;
    }

    for (const pr of effectivePRs) {
      try {
        const { owner, repo } = splitRepo(pr.repoFullName);
        const comments = await this.github.listComments(owner, repo, pr.prNumber);

        for (const c of comments) {
          if (c.user !== REVIEW_BOT_LOGIN) {
            continue;
          }

          const { classification } = classifyCoderabbitComment(c.body);

          if (classification === CodeRabbitCommentType.unknown) {
            this.log.debug({ ...logCtx, repo: pr.repoFullName, pr: pr.prNumber, commentId: c.id }, 'Skipping comment with unknown classification');
            continue;
          }

          if (classification === CodeRabbitCommentType.review_limited && hasOwnRetriggerMarker(c.body)) {
            this.log.debug({ ...logCtx, repo: pr.repoFullName, pr: pr.prNumber, commentId: c.id }, 'Skipping own retrigger comment');
            continue;
          }

          if (classification === CodeRabbitCommentType.review_limited) {
            candidates.push({ updatedAt: c.updatedAt, waitSeconds: parseWaitSeconds(c.body) });
          }

          const row = await this.coderabbitComments.findByCommentId(pr.pullRequestId, c.id);
          if (row && c.updatedAt <= row.last_seen_at) {
            this.log.debug({ ...logCtx, repo: pr.repoFullName, pr: pr.prNumber, commentId: c.id }, 'Skipping comment already processed and not edited since');
            continue;
          }

          const comment = {
            url: buildCommentUrl(pr.repoFullName, pr.prNumber, c.id),
            repoFullName: pr.repoFullName,
            prNumber: pr.prNumber,
            commentId: c.id,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
            prTitle: pr.prTitle,
            body: c.body,
            commentType: classification,
          };

          await this.onDetected(comment, pr.pullRequestId);
          found++;
        }
      } catch (err) {
        this.log.warn({ ...logCtx, repoFullName: pr.repoFullName, prNumber: pr.prNumber, error: err }, 'Failed to direct-check PR comments; continuing');
      }
    }

    if (found > 0) {
      this.log.info({ ...logCtx, found, checked: effectivePRs.length }, 'Direct comment check found comments');
    }

    return candidates;
  }
}
