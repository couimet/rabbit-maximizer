import type { CoderabbitGitHubClient } from './github/coderabbitGitHubClient.js';
import { hasOwnRetriggerMarker } from './github/hasOwnRetriggerMarker.js';
import { hasRateLimitMarker } from './github/hasRateLimitMarker.js';
import { parseWaitSeconds } from './github/parseWaitSeconds.js';
import { splitRepo } from './github/splitRepo.js';
import type { QueueItem } from './types/QueueItem.js';
import type { ValidationOutcome } from './types/ValidationOutcome.js';
import { MS_PER_SECOND } from './utils/durations.js';
import type { Config } from './config.js';
import { TYPES } from './inversify-types.js';

import type { Logger } from '@couimet/logger-contract';
import { StatusCodes } from 'http-status-codes';
import { inject, injectable } from 'inversify';

export interface SourceCommentValidator {
  validate(item: QueueItem): Promise<ValidationOutcome>;
}

@injectable()
export class SourceCommentValidatorImpl implements SourceCommentValidator {
  private readonly fallbackWaitSeconds: number;
  private readonly bufferSeconds: number;

  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.CoderabbitGitHubClient)
    private readonly github: CoderabbitGitHubClient,
    @inject(TYPES.Config) cfg: Config,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {
    this.fallbackWaitSeconds = cfg.REVIEW_LIMIT_FALLBACK_WAIT_SECONDS;
    this.bufferSeconds = cfg.REVIEW_LIMIT_BUFFER_SECONDS;
  }
  /* c8 ignore stop */

  async validate(item: QueueItem): Promise<ValidationOutcome> {
    const { owner, repo } = splitRepo(item.repo_full_name);

    let storedBody: string;
    try {
      storedBody = await this.github.fetchComment(owner, repo, item.source_comment_id);
    } catch (err: unknown) {
      const error = err as { status?: number };
      if (error.status === StatusCodes.NOT_FOUND || error.status === StatusCodes.GONE) {
        this.log.debug(
          { fn: 'SourceCommentValidator.validate', owner, repo, commentId: item.source_comment_id, status: error.status },
          'Source comment deleted; falling back to latest rate-limit comment',
        );
        storedBody = '';
      } else {
        throw err;
      }
    }

    if (storedBody !== '' && hasRateLimitMarker(storedBody) && !hasOwnRetriggerMarker(storedBody)) {
      this.log.debug(
        { fn: 'SourceCommentValidator.validate', owner, repo, commentId: item.source_comment_id },
        'Stored comment is still a valid rate-limit comment; proceeding',
      );
      return { action: 'proceed' };
    }

    const latest = await this.github.findLatestReviewLimitComment(owner, repo, item.pr_number);

    if (latest) {
      let latestBody: string;
      try {
        latestBody = await this.github.fetchComment(owner, repo, latest.comment_id);
      } catch (err: unknown) {
        const error = err as { status?: number };
        if (error.status === StatusCodes.NOT_FOUND || error.status === StatusCodes.GONE) {
          this.log.debug(
            { fn: 'SourceCommentValidator.validate', owner, repo, pr: item.pr_number, commentId: latest.comment_id, status: error.status },
            'Replacement comment deleted before fetch; skipping',
          );
          return { action: 'skip' };
        }
        throw err;
      }
      const waitSeconds = (parseWaitSeconds(latestBody) ?? this.fallbackWaitSeconds) + this.bufferSeconds;
      const notBefore = new Date(new Date(latest.updated_at).getTime() + waitSeconds * MS_PER_SECOND);

      this.log.debug(
        { fn: 'SourceCommentValidator.validate', owner, repo, pr: item.pr_number, newCommentId: latest.comment_id },
        'Stale source comment replaced; rescheduling with updated comment identity',
      );
      return { action: 'reschedule', notBefore, sourceComment: { commentId: latest.comment_id, commentUrl: latest.url } };
    }

    this.log.warn({ fn: 'SourceCommentValidator.validate', owner, repo, pr: item.pr_number }, 'Stale source comment with no replacement; skipping');
    return { action: 'skip' };
  }
}
