import type { QueueOrderRepository } from './db/queueOrderRepository.js';
import type { QueueRepository } from './db/queueRepository.js';
import type { SystemStateRepository } from './db/systemStateRepository.js';
import { RabbitMaximizerErrorCodes } from './errors/RabbitMaximizerErrorCodes.js';
import type { ProbeFactory } from './probes/ProbeFactory.js';
import { type QueueItem, TriggerSource } from './types/index.js';
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
    @inject(TYPES.QueueOrderRepository)
    private readonly queueOrder: QueueOrderRepository,
    @inject(TYPES.PrismaClient)
    private readonly prisma: PrismaClient,
    @inject(TYPES.Config) cfg: Config,
    @inject(TYPES.Pruner)
    private readonly pruner: Pruner,
    @inject(TYPES.ReviewTrigger)
    private readonly reviewTrigger: ReviewTrigger,
    @inject(TYPES.QueueRepository)
    private readonly queue: QueueRepository,
    @inject(TYPES.ProbeFactory)
    private readonly probeFactory: ProbeFactory,
    @inject(TYPES.SystemStateRepository)
    private readonly systemState: SystemStateRepository,
    @inject(TYPES.Logger) log: Logger,
  ) {
    super(log, cfg.SCHEDULER_TICK_INTERVAL_SEC * MS_PER_SECOND);
    this.baseBackoff = cfg.SCHEDULER_RETRY_BACKOFF_BASE_SEC * MS_PER_SECOND;
    this.maxBackoff = cfg.SCHEDULER_RETRY_BACKOFF_MAX_SEC * MS_PER_SECOND;
  }
  /* c8 ignore stop */

  protected onStart(): void {
    this.log.info({ fn: 'Scheduler.start', tickIntervalMs: this.intervalMs }, 'Starting scheduler');
  }

  protected onStop(): void {
    this.log.info({ fn: 'Scheduler.stop' }, 'Scheduler stopped');
  }

  protected async executeTick(): Promise<void> {
    const probe = this.probeFactory.createSchedulerProbe({ baseBackoff: this.baseBackoff, maxBackoff: this.maxBackoff });
    let item: QueueItem | undefined;
    try {
      await this.pruner.prune();
      probe.pruningCompleted();

      if (await this.systemState.isSchedulerPaused()) {
        probe.schedulerPaused();
        return;
      }

      const eligible = await this.queueOrder.getEffectiveOrder();
      item = eligible[0];
      if (!item) {
        probe.noItemsDue();
        return;
      }

      const item_ = item;
      probe.withItem(item_);

      const result = await this.reviewTrigger.trigger(item_, TriggerSource.scheduler);

      if (!result.success) {
        await this.prisma.$transaction(async (tx) => {
          const err = result.error;
          if (err.code === RabbitMaximizerErrorCodes.RETRIGGER_STALE_COMMENT_RESCHEDULE) {
            // Source comment was replaced by a newer rate-limit comment: reschedule to the
            // new comment's notBefore with updated source_comment data. Not a failure.
            const details = err.details as { notBefore: string; sourceComment: { commentId: number; commentUrl: string } };
            await this.queue.reschedule(item!.id, new Date(details.notBefore), details.sourceComment, tx);
          } else {
            // Genuine failure (stale-skip, replacement-deleted, or unknown): apply
            // exponential backoff. The item may succeed on a later attempt.
            const backoffMs = computeSchedulerBackoff(item!.attempts, this.baseBackoff, this.maxBackoff);
            await this.queue.backoff(item!.id, new Date(Date.now() + backoffMs), tx);
          }
          await probe.triggerFailed(err, tx);
        });
        return;
      }
    } catch (err: unknown) {
      if (!item) {
        probe.tickFailed(err);
        return;
      }

      const error = err as { status?: number };

      if (error.status !== undefined && TERMINAL_HTTP_STATUSES.includes(error.status)) {
        await this.prisma.$transaction(async (tx) => {
          await this.queue.markFailed(item!.id, tx);
          await probe.prClosedOrMerged(error.status!, tx);
        });
        return;
      }

      const backoffMs = computeSchedulerBackoff(item!.attempts, this.baseBackoff, this.maxBackoff);

      await this.prisma.$transaction(async (tx) => {
        await this.queue.backoff(item!.id, new Date(Date.now() + backoffMs), tx);
        await probe.backedOff(backoffMs, item!.attempts, err, tx);
      });
    }
  }
}
