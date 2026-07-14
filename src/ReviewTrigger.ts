import type { PullRequestRepository } from './db/pullRequestRepository.js';
import type { QueueRepository } from './db/queueRepository.js';
import { RabbitMaximizerError } from './errors/RabbitMaximizerError.js';
import { RabbitMaximizerErrorCodes } from './errors/RabbitMaximizerErrorCodes.js';
import type { CoderabbitGitHubClient } from './github/coderabbitGitHubClient.js';
import { hasOwnRetriggerMarker } from './github/hasOwnRetriggerMarker.js';
import { hasRateLimitMarker } from './github/hasRateLimitMarker.js';
import { parseWaitSeconds } from './github/parseWaitSeconds.js';
import { splitRepo } from './github/splitRepo.js';
import { ProbeFactory } from './probes/ProbeFactory.js';
import type { ReviewRetriggerProbe } from './probes/ReviewRetriggerProbe.js';
import { type QueueItem, TriggerSource } from './types/index.js';
import { RabbitResult } from './types/RabbitResult.js';
import { MS_PER_SECOND } from './utils/durations.js';
import type { Config } from './config.js';
import { TYPES } from './inversify-types.js';

import type { Logger } from '@couimet/logger-contract';
import type { PrismaClient } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { inject, injectable } from 'inversify';
import { randomUUID } from 'node:crypto';

export type TriggerDetails = { retriggeredCommentUrl: string };

@injectable()
export class ReviewTrigger {
  private readonly postCooldownMs: number;
  private readonly fallbackWaitSeconds: number;
  private readonly bufferSeconds: number;

  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.CoderabbitGitHubClient)
    private readonly github: CoderabbitGitHubClient,
    @inject(TYPES.ProbeFactory)
    private readonly probeFactory: ProbeFactory,
    @inject(TYPES.QueueRepository)
    private readonly queue: QueueRepository,
    @inject(TYPES.PullRequestRepository)
    private readonly pullRequests: PullRequestRepository,
    @inject(TYPES.PrismaClient)
    private readonly prisma: PrismaClient,
    @inject(TYPES.Config) cfg: Config,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {
    this.postCooldownMs = cfg.SCHEDULER_POST_COOLDOWN_SEC * MS_PER_SECOND;
    this.fallbackWaitSeconds = cfg.REVIEW_LIMIT_FALLBACK_WAIT_SEC;
    this.bufferSeconds = cfg.REVIEW_LIMIT_BUFFER_SEC;
  }
  /* c8 ignore stop */

  async trigger(item: QueueItem, triggerSource: TriggerSource): Promise<RabbitResult<TriggerDetails>> {
    const probe = this.probeFactory.createReviewRetriggerProbe(item);
    const { owner, repo } = splitRepo(item.repo_full_name);

    let storedBody: string;
    try {
      storedBody = await this.github.fetchComment(owner, repo, item.source_comment_id);
    } catch (err: unknown) {
      const error = err as { status?: number };
      if (error.status === StatusCodes.NOT_FOUND || error.status === StatusCodes.GONE) {
        storedBody = '';
      } else {
        throw err;
      }
    }

    if (storedBody !== '' && hasRateLimitMarker(storedBody) && !hasOwnRetriggerMarker(storedBody)) {
      return this.postAndRecord(item, probe, triggerSource);
    }

    const latest = await this.github.findLatestReviewLimitComment(owner, repo, item.pr_number);

    if (!latest) {
      probe.staleCommentSkipped();
      return RabbitResult.err(
        new RabbitMaximizerError({
          code: RabbitMaximizerErrorCodes.RETRIGGER_STALE_COMMENT_SKIP,
          message: 'No replacement rate-limit comment found',
          functionName: 'ReviewTrigger.trigger',
        }),
      );
    }

    let latestBody: string;
    try {
      latestBody = await this.github.fetchComment(owner, repo, latest.comment_id);
    } catch (err: unknown) {
      const error = err as { status?: number };
      if (error.status === StatusCodes.NOT_FOUND || error.status === StatusCodes.GONE) {
        probe.staleCommentReplacementDeleted(latest.comment_id);
        return RabbitResult.err(
          new RabbitMaximizerError({
            code: RabbitMaximizerErrorCodes.RETRIGGER_STALE_COMMENT_REPLACEMENT_DELETED,
            message: 'Replacement comment was deleted before fetch',
            functionName: 'ReviewTrigger.trigger',
          }),
        );
      }
      throw err;
    }

    const waitSeconds = (parseWaitSeconds(latestBody) ?? this.fallbackWaitSeconds) + this.bufferSeconds;
    const notBefore = new Date(new Date(latest.updated_at).getTime() + waitSeconds * MS_PER_SECOND);

    probe.staleCommentRescheduled(notBefore);
    return RabbitResult.err(
      new RabbitMaximizerError({
        code: RabbitMaximizerErrorCodes.RETRIGGER_STALE_COMMENT_RESCHEDULE,
        message: 'Source comment was replaced; item must be rescheduled',
        functionName: 'ReviewTrigger.trigger',
        details: { notBefore: notBefore.toISOString(), sourceComment: { commentId: latest.comment_id, commentUrl: latest.url } },
      }),
    );
  }

  private async postAndRecord(item: QueueItem, probe: ReviewRetriggerProbe, triggerSource: TriggerSource): Promise<RabbitResult<TriggerDetails>> {
    const runId = randomUUID();
    this.log.info({ fn: 'ReviewTrigger.trigger', repo: item.repo_full_name, pr: item.pr_number, queueId: item.id, runId }, 'Posting retrigger');

    const { htmlUrl: retriggeredCommentUrl } = await this.github.postRetrigger(
      item.repo_full_name,
      item.pr_number,
      item.source_comment_url,
      runId,
      triggerSource,
    );

    const cooldownUntil = new Date(Date.now() + this.postCooldownMs);

    await this.prisma.$transaction(async (tx) => {
      await this.queue.markRetriggered(item.id, cooldownUntil, retriggeredCommentUrl, tx);
      await this.pullRequests.incrementRetriggerCount(item.pull_request_id, tx);
      await probe.reviewRetriggered(retriggeredCommentUrl, cooldownUntil, tx);
    });

    return RabbitResult.ok({ retriggeredCommentUrl });
  }
}
