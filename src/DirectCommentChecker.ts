import {
  buildCommentUrl,
  classifyCoderabbitComment,
  type CoderabbitGitHubClient,
  hasOwnRetriggerMarker,
  hasRateLimitMarker,
  splitRepo,
} from './github/index.js';
import type { DirectCheckPR, OnDetectedCallback } from './types/index.js';
import { TYPES } from './domain.js';

import type { Logger, LoggingContext } from '@couimet/logger-contract';
import { inject, injectable } from 'inversify';

export interface DirectCommentChecker {
  check(prs: readonly DirectCheckPR[]): Promise<void>;
}

@injectable()
export class DirectCommentCheckerImpl implements DirectCommentChecker {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.CoderabbitGitHubClient)
    private readonly github: CoderabbitGitHubClient,
    @inject(TYPES.OnDetectedCallback)
    private readonly onDetected: OnDetectedCallback,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  /**
   * Check known PRs directly for rate-limit comments via the comments API, bypassing
   * GitHub search indexing delay. At ~21 open PRs and ~90s tick interval this adds
   * ~14 API calls/min, well under the 5000/hr authenticated rate limit. Revisit if
   * the monitored PR count grows past ~200.
   */
  async check(prs: readonly DirectCheckPR[]): Promise<void> {
    const logCtx: LoggingContext = { fn: 'DirectCommentChecker.check' };
    let found = 0;

    for (const pr of prs) {
      try {
        const { owner, repo } = splitRepo(pr.repoFullName);
        const comments = await this.github.listComments(owner, repo, pr.prNumber);

        for (const c of comments) {
          if (!hasRateLimitMarker(c.body) || hasOwnRetriggerMarker(c.body)) {
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
            commentType: classifyCoderabbitComment(c.body),
          };

          await this.onDetected(comment, pr.pullRequestId);
          found++;
        }
      } catch (err) {
        this.log.warn({ ...logCtx, repoFullName: pr.repoFullName, prNumber: pr.prNumber, error: err }, 'Failed to direct-check PR comments; continuing');
      }
    }

    if (found > 0) {
      this.log.info({ ...logCtx, found, checked: prs.length }, 'Direct comment check found rate-limit comments');
    }
  }
}
