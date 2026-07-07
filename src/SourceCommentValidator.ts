import type { CoderabbitGitHubClient } from './github/coderabbitGitHubClient.js';
import { hasOwnRetriggerMarker } from './github/hasOwnRetriggerMarker.js';
import { hasRateLimitMarker } from './github/hasRateLimitMarker.js';
import { parseWaitSeconds } from './github/parseWaitSeconds.js';
import { splitRepo } from './github/splitRepo.js';
import type { QueueItem } from './types/QueueItem.js';
import { MS_PER_SECOND } from './utils/durations.js';
import type { Config } from './config.js';
import { TYPES } from './inversify-types.js';

import { inject, injectable } from 'inversify';

export type ValidationOutcome = { action: 'proceed' } | { action: 'reschedule'; notBefore: Date } | { action: 'skip' };

export interface SourceCommentValidator {
  validate(item: QueueItem): Promise<ValidationOutcome>;
}

@injectable()
export class SourceCommentValidatorImpl implements SourceCommentValidator {
  private readonly fallbackWaitMs: number;

  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.CoderabbitGitHubClient)
    private readonly github: CoderabbitGitHubClient,
    @inject(TYPES.Config) cfg: Config,
  ) {
    this.fallbackWaitMs = cfg.REVIEW_LIMIT_FALLBACK_WAIT_SECONDS * MS_PER_SECOND;
  }
  /* c8 ignore stop */

  async validate(item: QueueItem): Promise<ValidationOutcome> {
    const { owner, repo } = splitRepo(item.repo_full_name);

    const storedBody = await this.github.fetchComment(owner, repo, item.source_comment_id);

    if (storedBody !== '' && hasRateLimitMarker(storedBody) && !hasOwnRetriggerMarker(storedBody)) {
      return { action: 'proceed' };
    }

    const latest = await this.github.findLatestReviewLimitComment(owner, repo, item.pr_number);

    if (latest) {
      const waitSeconds = parseWaitSeconds(storedBody || '') ?? this.fallbackWaitMs / 1000;
      const notBefore = new Date(new Date(latest.updated_at).getTime() + waitSeconds * MS_PER_SECOND);

      return { action: 'reschedule', notBefore };
    }

    return { action: 'skip' };
  }
}
