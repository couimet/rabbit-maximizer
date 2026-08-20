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
import type { ProbeFactory } from './probes/index.js';
import type { DirectCheckPR, OnDetectedCallback, ReviewLimitCandidate } from './types/index.js';
import { extractCoderabbitRunId } from './utils/index.js';
import { CodeRabbitCommentType, TYPES } from './domain.js';

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
    @inject(TYPES.ProbeFactory)
    private readonly probeFactory: ProbeFactory,
  ) {}
  /* c8 ignore stop */

  /**
   * Check known PRs directly for rate-limit comments via the comments API, bypassing
   * GitHub search indexing delay. At ~21 open PRs and ~90s tick interval this adds
   * ~840 API calls/hr, well under the 5000/hr authenticated rate limit. Revisit if
   * the monitored PR count grows past ~125.
   */
  async check(prs: readonly DirectCheckPR[]): Promise<ReviewLimitCandidate[]> {
    const probe = this.probeFactory.createDirectCommentCheckProbe();
    const candidates: ReviewLimitCandidate[] = [];
    let found = 0;

    let effectivePRs: typeof prs;
    if (prs.length > MAX_DIRECT_CHECK_PRS) {
      probe.truncated(prs.length, MAX_DIRECT_CHECK_PRS);
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
          probe.withComment(pr.repoFullName, pr.prNumber, c.id);

          const { classification } = classifyCoderabbitComment(c.body);

          if (classification === CodeRabbitCommentType.unknown) {
            probe.skippedUnclassified();
            continue;
          }

          if (classification === CodeRabbitCommentType.review_limited && hasOwnRetriggerMarker(c.body)) {
            probe.skippedOwnRetrigger();
            continue;
          }

          if (classification === CodeRabbitCommentType.review_limited) {
            candidates.push({ updatedAt: c.updatedAt, waitSeconds: parseWaitSeconds(c.body) });
          }

          const commentUrl = buildCommentUrl(pr.repoFullName, pr.prNumber, c.id);

          const row = await this.coderabbitComments.findByCommentId(pr.pullRequestId, c.id);
          if (row) {
            const storedRunId = row.coderabbit_run_id;
            const freshRunId = extractCoderabbitRunId(c.body);
            if (storedRunId !== null && freshRunId === undefined) {
              await probe.runIdCleared(commentUrl, storedRunId);
            } else if (freshRunId !== undefined && freshRunId !== storedRunId) {
              await (storedRunId === null ? probe.runIdFirstSeen(commentUrl, freshRunId) : probe.runIdChanged(commentUrl, storedRunId, freshRunId));
            }
          }
          if (row && c.updatedAt <= row.last_seen_at) {
            probe.skippedAlreadySeen();
            continue;
          }

          const comment = {
            url: commentUrl,
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
        probe.clearComment();
      } catch (err) {
        probe.prCheckFailed(pr.repoFullName, pr.prNumber, err);
      }
    }

    if (found > 0) {
      probe.found(found, effectivePRs.length);
    }

    return candidates;
  }
}
