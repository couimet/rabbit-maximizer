import type { EventRepository } from './db/eventRepository.js';
import type { QueueOrderRepository } from './db/queueOrderRepository.js';
import type { QueueRepository } from './db/queueRepository.js';
import { RabbitMaximizerError } from './errors/RabbitMaximizerError.js';
import { RabbitMaximizerErrorCodes } from './errors/RabbitMaximizerErrorCodes.js';
import type { CoderabbitGitHubClient } from './github/coderabbitGitHubClient.js';
import type { ObservationContextProvider } from './observability/observationContext.js';
import { EventType, type QueueItem } from './types/index.js';
import { computeSchedulerBackoff } from './utils/index.js';
import type { Config } from './config.js';
import { TYPES } from './inversify-types.js';
import type { Pruner } from './Pruner.js';

import type { Logger } from '@couimet/logger-contract';
import { type PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';
import { randomUUID } from 'node:crypto';

const TICK_INTERVAL_MS = 10_000;
const HTTP_NOT_FOUND = 404;
const HTTP_GONE = 410;
const SECONDS_TO_MS = 1000;

const TERMINAL_HTTP_STATUSES = [HTTP_NOT_FOUND, HTTP_GONE];

@injectable()
export class Scheduler {
  private intervalId: ReturnType<typeof setInterval> | undefined;
  private tickPromise: Promise<void> | null = null;
  private stopped = false;
  private readonly postCooldownMs: number;
  private readonly baseBackoff: number;
  private readonly maxBackoff: number;

  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.QueueRepository)
    private readonly queue: QueueRepository,
    @inject(TYPES.QueueOrderRepository)
    private readonly queueOrder: QueueOrderRepository,
    @inject(TYPES.CoderabbitGitHubClient)
    private readonly github: CoderabbitGitHubClient,
    @inject(TYPES.EventRepository)
    private readonly events: EventRepository,
    @inject(TYPES.ObservationContextProvider)
    private readonly observation: ObservationContextProvider,
    @inject(TYPES.PrismaClient)
    private readonly prisma: PrismaClient,
    @inject(TYPES.Config) cfg: Config,
    @inject(TYPES.Pruner)
    private readonly pruner: Pruner,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {
    this.postCooldownMs = cfg.SCHEDULER_POST_COOLDOWN * SECONDS_TO_MS;
    this.baseBackoff = cfg.SCHEDULER_RETRY_BACKOFF_BASE * SECONDS_TO_MS;
    this.maxBackoff = cfg.SCHEDULER_RETRY_BACKOFF_MAX * SECONDS_TO_MS;
  }
  /* c8 ignore stop */

  start(): { stop(): Promise<void> } {
    this.log.info({ fn: 'Scheduler.start', tickIntervalMs: TICK_INTERVAL_MS }, 'Starting scheduler');

    this.tick();

    this.intervalId = setInterval(() => {
      this.tick();
    }, TICK_INTERVAL_MS);

    return { stop: () => this.stop() };
  }

  private async stop(): Promise<void> {
    this.stopped = true;
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    if (this.tickPromise) {
      await this.tickPromise;
    }
    this.log.info({ fn: 'Scheduler.stop' }, 'Scheduler stopped');
  }

  private async tick(): Promise<void> {
    if (this.stopped || this.tickPromise) return;
    this.tickPromise = this.executeTick();
    try {
      await this.tickPromise;
    } finally {
      this.tickPromise = null;
    }
  }

  private async executeTick(): Promise<void> {
    let item: QueueItem | undefined;
    try {
      await this.pruner.prune();

      const eligible = await this.queueOrder.getEffectiveOrder();
      item = eligible[0];
      if (!item) return;

      const item_ = item;
      const runId = randomUUID();

      const sourceCommentUrl = item_.source_comment_url;
      if (sourceCommentUrl == null) {
        throw new RabbitMaximizerError({
          code: RabbitMaximizerErrorCodes.MISSING_SOURCE_COMMENT_URL,
          functionName: 'Scheduler.executeTick',
          message: 'source_comment_url is required but was null or undefined',
          details: { queueItemId: item_.id, repo: item_.repo_full_name, pr: item_.pr_number },
        });
      }

      const { htmlUrl: postedCommentUrl } = await this.github.postRetrigger(item_.repo_full_name, item_.pr_number, sourceCommentUrl, runId);

      const obs = this.observation.current();

      await this.prisma.$transaction(async (tx) => {
        await this.queue.markPosted(item_.id, new Date(Date.now() + this.postCooldownMs), tx);

        await this.events.record(
          {
            type: EventType.posted,
            repo_full_name: item_.repo_full_name,
            pr_number: item_.pr_number,
            correlation_id: obs.correlationId,
            request_id: obs.requestId,
            version: obs.version,
            payload: {
              source_comment_url: sourceCommentUrl!,
              posted_comment_url: postedCommentUrl,
            },
          },
          tx,
        );
      });

      this.log.info({ fn: 'Scheduler.tick', repo: item_.repo_full_name, pr: item_.pr_number, queueId: item_.id, runId }, 'Retrigger posted');
    } catch (err: unknown) {
      if (!item) {
        this.log.warn({ fn: 'Scheduler.tick', error: err }, 'executeTick failed before item was fetched');
        return;
      }

      const error = err as { status?: number };

      if (error.status !== undefined && TERMINAL_HTTP_STATUSES.includes(error.status)) {
        const obs = this.observation.current();
        const item_ = item;

        await this.prisma.$transaction(async (tx) => {
          await this.queue.markFailed(item_.id, tx);

          await this.events.record(
            {
              type: EventType.failed,
              repo_full_name: item_.repo_full_name,
              pr_number: item_.pr_number,
              correlation_id: obs.correlationId,
              request_id: obs.requestId,
              version: obs.version,
              payload: {
                reason: 'PR closed or merged',
              },
            },
            tx,
          );
        });

        this.log.info(
          {
            fn: 'Scheduler.tick',
            repo: item.repo_full_name,
            pr: item.pr_number,
            queueId: item.id,
            status: error.status,
          },
          'PR closed or merged; marked failed',
        );
        return;
      }

      if (err instanceof RabbitMaximizerError && err.code === RabbitMaximizerErrorCodes.MISSING_SOURCE_COMMENT_URL) {
        const obs = this.observation.current();
        const item_ = item;

        await this.prisma.$transaction(async (tx) => {
          await this.queue.markFailed(item_.id, tx);

          await this.events.record(
            {
              type: EventType.failed,
              repo_full_name: item_.repo_full_name,
              pr_number: item_.pr_number,
              correlation_id: obs.correlationId,
              request_id: obs.requestId,
              version: obs.version,
              payload: {
                reason: 'Missing source comment URL',
              },
            },
            tx,
          );
        });

        this.log.info(
          {
            fn: 'Scheduler.tick',
            repo: item.repo_full_name,
            pr: item.pr_number,
            queueId: item.id,
          },
          'Missing source comment URL; marked failed',
        );
        return;
      }

      const backoffMs = computeSchedulerBackoff(item.attempts, this.baseBackoff, this.maxBackoff);

      await this.prisma.$transaction(async (tx) => {
        await this.queue.reschedule(item!.id, new Date(Date.now() + backoffMs), tx);
      });

      this.log.warn(
        {
          fn: 'Scheduler.tick',
          repo: item.repo_full_name,
          pr: item.pr_number,
          queueId: item.id,
          backoffMs,
          attempts: item.attempts,
        },
        'Post retrigger failed; rescheduled with backoff',
      );
    }
  }
}
