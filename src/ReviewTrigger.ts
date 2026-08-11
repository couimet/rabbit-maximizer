import type { PullRequestRepository, QueueRepository, SystemStateRepository } from './db/index.js';
import { RabbitMaximizerError, RabbitMaximizerErrorCodes } from './errors/index.js';
import {
  classifyCoderabbitComment,
  type CoderabbitGitHubClient,
  hasOwnRetriggerMarker,
  hasRateLimitMarker,
  parseWaitSeconds,
  splitRepo,
} from './github/index.js';
import { ProbeFactory, type ReviewRetriggerProbe } from './probes/index.js';
import type { CommentDiagnosis, QueueItem, RetriggerDecision, RetriggerDiagnosis } from './types/index.js';
import { generateRunId, MS_PER_SECOND } from './utils/index.js';
import type { Config } from './config.js';
import { CodeRabbitCommentType, QueueStatus, RabbitResult, TriggerSource, TYPES } from './domain.js';

import type { Logger } from '@couimet/logger-contract';
import type { PrismaClient } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { inject, injectable } from 'inversify';

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
    @inject(TYPES.SystemStateRepository)
    private readonly systemState: SystemStateRepository,
    @inject(TYPES.Config) cfg: Config,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {
    this.postCooldownMs = cfg.CODERABBIT_ACCOUNT_COOLDOWN_SEC * MS_PER_SECOND;
    this.fallbackWaitSeconds = cfg.REVIEW_LIMIT_FALLBACK_WAIT_SEC;
    this.bufferSeconds = cfg.REVIEW_LIMIT_BUFFER_SEC;
  }
  /* c8 ignore stop */

  async trigger(item: QueueItem, triggerSource: TriggerSource): Promise<RabbitResult<TriggerDetails>> {
    if (item.status !== QueueStatus.pending) {
      this.log.warn({ fn: 'ReviewTrigger.trigger', queueId: item.id, status: item.status }, 'Item not pending; refusing to trigger');
      return RabbitResult.err(
        new RabbitMaximizerError({
          code: RabbitMaximizerErrorCodes.RETRIGGER_ITEM_NOT_PENDING,
          message: 'Item is not in pending status',
          functionName: 'ReviewTrigger.trigger',
          details: { status: item.status },
        }),
      );
    }

    const probe = this.probeFactory.createReviewRetriggerProbe(item);
    const { owner, repo } = splitRepo(item.repo_full_name);
    const includeDiagnosis = triggerSource === TriggerSource.scheduler;

    let storedBody: string;
    let sourceCreatedAt: string;
    let sourceUpdatedAt: string;
    try {
      const result = await this.github.fetchComment(owner, repo, item.source_comment_id);
      storedBody = result.body;
      sourceCreatedAt = result.createdAt;
      sourceUpdatedAt = result.updatedAt;
    } catch (err: unknown) {
      const error = err as { status?: number };
      if (error.status === StatusCodes.NOT_FOUND || error.status === StatusCodes.GONE) {
        storedBody = '';
        sourceCreatedAt = '';
        sourceUpdatedAt = '';
      } else {
        throw err;
      }
    }

    if (storedBody !== '' && hasRateLimitMarker(storedBody) && !hasOwnRetriggerMarker(storedBody)) {
      const diagnosis = includeDiagnosis ? this.buildDiagnosis(item.source_comment_url, sourceCreatedAt, sourceUpdatedAt, storedBody, 'source') : undefined;
      return this.postAndRecord(item, probe, triggerSource, item.source_comment_url, diagnosis);
    }

    const latest = await this.github.findLatestReviewLimitComment(owner, repo, item.pr_number);

    if (!latest) {
      if (storedBody === '') {
        this.log.info(
          { fn: 'ReviewTrigger.trigger', repo: item.repo_full_name, pr: item.pr_number, queueId: item.id },
          'No review-limit comment found; posting retrigger without a reply target',
        );
        const diagnosis = includeDiagnosis ? this.buildDirectDiagnosis(item.source_comment_url) : undefined;
        return this.postAndRecord(item, probe, triggerSource, undefined, diagnosis);
      }
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
      const result = await this.github.fetchComment(owner, repo, latest.commentId);
      latestBody = result.body;
    } catch (err: unknown) {
      const error = err as { status?: number };
      if (error.status === StatusCodes.NOT_FOUND || error.status === StatusCodes.GONE) {
        probe.staleCommentReplacementDeleted(latest.commentId);
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
    const rescheduleEarliest = new Date(new Date(latest.updatedAt).getTime() + waitSeconds * MS_PER_SECOND);

    probe.staleCommentRescheduled(rescheduleEarliest);
    return RabbitResult.err(
      new RabbitMaximizerError({
        code: RabbitMaximizerErrorCodes.RETRIGGER_STALE_COMMENT_RESCHEDULE,
        message: 'Source comment was replaced; item must be rescheduled',
        functionName: 'ReviewTrigger.trigger',
        details: { rescheduleEarliest: rescheduleEarliest.toISOString(), sourceComment: { commentId: latest.commentId, commentUrl: latest.url } },
      }),
    );
  }

  private buildDiagnosis(
    sourceCommentUrl: string,
    sourceCreatedAt: string,
    sourceUpdatedAt: string,
    storedBody: string,
    decision: RetriggerDecision,
  ): RetriggerDiagnosis {
    const { classification, matchedMarker } = classifyCoderabbitComment(storedBody);

    const sourceComment: CommentDiagnosis = {
      url: sourceCommentUrl,
      createdAt: sourceCreatedAt,
      updatedAt: sourceUpdatedAt,
      classification,
      matchedMarker,
    };

    const waitSeconds = parseWaitSeconds(storedBody);

    return { sourceComment, waitSeconds, decision };
  }

  private buildDirectDiagnosis(sourceCommentUrl: string): RetriggerDiagnosis {
    const sourceComment: CommentDiagnosis = {
      url: sourceCommentUrl,
      createdAt: '',
      updatedAt: '',
      classification: CodeRabbitCommentType.unknown,
      matchedMarker: undefined,
    };

    return { sourceComment, waitSeconds: undefined, decision: 'direct' };
  }

  private async postAndRecord(
    item: QueueItem,
    probe: ReviewRetriggerProbe,
    triggerSource: TriggerSource,
    replyToCommentUrl: string | undefined,
    diagnosis: RetriggerDiagnosis | undefined,
  ): Promise<RabbitResult<TriggerDetails>> {
    const runId = generateRunId();
    this.log.info({ fn: 'ReviewTrigger.trigger', repo: item.repo_full_name, pr: item.pr_number, queueId: item.id, runId }, 'Posting retrigger');

    const { htmlUrl: retriggeredCommentUrl } = await this.github.postRetrigger(
      item.repo_full_name,
      item.pr_number,
      replyToCommentUrl,
      runId,
      triggerSource,
      diagnosis,
    );

    const cooldownUntil = new Date(Date.now() + this.postCooldownMs);

    await this.prisma.$transaction(async (tx) => {
      await this.queue.markRetriggered(item.id, cooldownUntil, retriggeredCommentUrl, tx);
      await this.pullRequests.incrementRetriggerCount(item.pull_request_id, tx);
      await probe.reviewRetriggered(retriggeredCommentUrl, tx);
      const existing = await this.systemState.getNextReviewAvailableAt(tx);
      const nextAvailable = existing !== undefined && existing > cooldownUntil ? existing : cooldownUntil;
      await this.systemState.setNextReviewAvailableAt(nextAvailable, tx);
    });

    return RabbitResult.ok({ retriggeredCommentUrl });
  }
}
