import type { EventRepository } from './db/eventRepository.js';
import type { QueueOrderRepository } from './db/queueOrderRepository.js';
import type { QueueRepository } from './db/queueRepository.js';
import type { SystemStateRepository } from './db/systemStateRepository.js';
import { RabbitMaximizerError } from './errors/RabbitMaximizerError.js';
import { RabbitMaximizerErrorCodes } from './errors/RabbitMaximizerErrorCodes.js';
import type { ObservationContextProvider } from './observability/observationContext.js';
import { EventType, type QueueItem, TriggerSource } from './types/index.js';
import { computeSchedulerBackoff, MS_PER_SECOND } from './utils/index.js';
import type { Config } from './config.js';
import { IntervalService } from './IntervalService.js';
import { TYPES } from './inversify-types.js';
import type { Pruner } from './Pruner.js';
import { ReviewTrigger } from './ReviewTrigger.js';

import type { Logger } from '@couimet/logger-contract';
import { type PrismaClient } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { inject, injectable } from 'inversify';

const TERMINAL_HTTP_STATUSES = [StatusCodes.NOT_FOUND, StatusCodes.GONE];

@injectable()
export class Scheduler extends IntervalService {
  private readonly baseBackoff: number;
  private readonly maxBackoff: number;

  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.QueueRepository)
    private readonly queue: QueueRepository,
    @inject(TYPES.QueueOrderRepository)
    private readonly queueOrder: QueueOrderRepository,
    // TODO [2026-07-15]: #123 — remove once retrigger/failure event recording moves to probes
    @inject(TYPES.EventRepository)
    private readonly events: EventRepository,
    @inject(TYPES.ObservationContextProvider)
    private readonly observation: ObservationContextProvider,
    @inject(TYPES.PrismaClient)
    private readonly prisma: PrismaClient,
    @inject(TYPES.Config) cfg: Config,
    @inject(TYPES.Pruner)
    private readonly pruner: Pruner,
    @inject(TYPES.ReviewTrigger)
    private readonly reviewTrigger: ReviewTrigger,
    @inject(TYPES.SystemStateRepository)
    private readonly systemState: SystemStateRepository,
    @inject(TYPES.Logger) log: Logger,
  ) {
    super(log, cfg.SCHEDULER_TICK_INTERVAL_MS);
    this.baseBackoff = cfg.SCHEDULER_RETRY_BACKOFF_BASE * MS_PER_SECOND;
    this.maxBackoff = cfg.SCHEDULER_RETRY_BACKOFF_MAX * MS_PER_SECOND;
  }
  /* c8 ignore stop */

  protected onStart(): void {
    this.log.info({ fn: 'Scheduler.start', tickIntervalMs: this.intervalMs }, 'Starting scheduler');
  }

  protected onStop(): void {
    this.log.info({ fn: 'Scheduler.stop' }, 'Scheduler stopped');
  }

  private async handleStaleCommentReschedule(item: QueueItem, err: RabbitMaximizerError): Promise<void> {
    const details = err.details as { notBefore: string; sourceComment: { commentId: number; commentUrl: string } };
    const notBefore = new Date(details.notBefore);
    const sourceComment = details.sourceComment;
    await this.prisma.$transaction(async (tx) => {
      await this.queue.reschedule(item.id, notBefore, sourceComment, tx);
    });
    this.log.info(
      { fn: 'Scheduler.tick', repo: item.repo_full_name, pr: item.pr_number, queueId: item.id, newNotBefore: notBefore, error: err },
      'Stale source comment replaced; rescheduled with updated not_before',
    );
  }

  private async handleStaleCommentSkip(item: QueueItem, err: RabbitMaximizerError): Promise<void> {
    const backoffMs = computeSchedulerBackoff(item.attempts, this.baseBackoff, this.maxBackoff);
    await this.prisma.$transaction(async (tx) => {
      await this.queue.backoff(item.id, new Date(Date.now() + backoffMs), tx);
    });
    this.log.warn(
      { fn: 'Scheduler.tick', repo: item.repo_full_name, pr: item.pr_number, queueId: item.id, backoffMs, error: err },
      'Stale source comment with no replacement; rescheduled with backoff',
    );
  }

  protected async executeTick(): Promise<void> {
    let item: QueueItem | undefined;
    try {
      await this.pruner.prune();

      if (await this.systemState.isSchedulerPaused()) {
        this.log.debug({ fn: 'Scheduler.tick' }, 'Scheduler is paused; skipping tick');
        return;
      }

      const eligible = await this.queueOrder.getEffectiveOrder();
      item = eligible[0];
      if (!item) return;

      const item_ = item;

      const result = await this.reviewTrigger.trigger(item_, TriggerSource.scheduler);

      if (!result.success) {
        const err = result.error;
        switch (err.code) {
          case RabbitMaximizerErrorCodes.RETRIGGER_STALE_COMMENT_RESCHEDULE:
            await this.handleStaleCommentReschedule(item_, err);
            return;
          case RabbitMaximizerErrorCodes.RETRIGGER_STALE_COMMENT_REPLACEMENT_DELETED:
          case RabbitMaximizerErrorCodes.RETRIGGER_STALE_COMMENT_SKIP:
            await this.handleStaleCommentSkip(item_, err);
            return;
          default:
            throw RabbitMaximizerError.forUnexpectedSwitchDefault('TriggerOutcome.error.code', err.code, 'Scheduler.executeTick');
        }
      }
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

          // TODO [2026-07-15]: #123 — SchedulerFailureProbe: encapsulate event recording; scheduler should not own EventRepository
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

      const backoffMs = computeSchedulerBackoff(item.attempts, this.baseBackoff, this.maxBackoff);

      await this.prisma.$transaction(async (tx) => {
        await this.queue.backoff(item!.id, new Date(Date.now() + backoffMs), tx);
      });

      this.log.warn(
        {
          fn: 'Scheduler.tick',
          repo: item.repo_full_name,
          pr: item.pr_number,
          queueId: item.id,
          backoffMs,
          attempts: item.attempts,
          error: err,
        },
        'Post retrigger failed; rescheduled with backoff',
      );
    }
  }
}
