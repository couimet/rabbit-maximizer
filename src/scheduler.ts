import { type PullRequestRepository, type QueueOrderRepository, type QueueRepository, type SystemStateRepository } from './db/index.js';
import { RabbitMaximizerErrorCodes, StaleCommentRescheduledError } from './errors/index.js';
import { isPRClosedWithoutMerge, isPRMerged, type PRStateFetcher } from './github/index.js';
import type { ProbeFactory, SchedulerProbe } from './probes/index.js';
import type { QueueItem } from './types/index.js';
import { computeSchedulerBackoff, isTerminalHttpStatus, MS_PER_SECOND } from './utils/index.js';
import type { Config } from './config.js';
import { IntervalService, PrState, QueueStatus, Resolution, TriggerSource, TYPES } from './domain.js';
import { type Pruner, ReviewTrigger } from './services.js';

import type { Logger } from '@couimet/logger-contract';
import { type PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';

@injectable()
export class Scheduler extends IntervalService {
  private readonly baseBackoff: number;
  private readonly maxBackoff: number;
  private readonly maxRetriggerAttempts: number;
  private readonly retriggerSpacingMs: number;
  private readonly maxRetriggerAgeMs: number;

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
    @inject(TYPES.PullRequestRepository)
    private readonly pullRequests: PullRequestRepository,
    @inject(TYPES.SystemStateRepository)
    private readonly systemState: SystemStateRepository,
    @inject(TYPES.PRStateFetcher)
    private readonly prStateFetcher: PRStateFetcher,
    @inject(TYPES.Logger) log: Logger,
  ) {
    super(log, cfg.SCHEDULER_TICK_INTERVAL_SEC * MS_PER_SECOND);
    this.baseBackoff = cfg.SCHEDULER_RETRY_BACKOFF_BASE_SEC * MS_PER_SECOND;
    this.maxBackoff = cfg.SCHEDULER_RETRY_BACKOFF_MAX_SEC * MS_PER_SECOND;
    this.maxRetriggerAttempts = cfg.MAX_RETRIGGER_ATTEMPTS;
    this.retriggerSpacingMs = cfg.SCHEDULER_RETRIGGER_SPACING_SEC * MS_PER_SECOND;
    this.maxRetriggerAgeMs = cfg.SCHEDULER_MAX_RETRIGGER_AGE_SEC * MS_PER_SECOND;
  }
  /* c8 ignore stop */

  protected onStart(): void {
    this.log.info({ fn: 'Scheduler.start', tickIntervalMs: this.intervalMs }, 'Starting scheduler');
  }

  protected onStop(): void {
    this.log.info({ fn: 'Scheduler.stop' }, 'Scheduler stopped');
  }

  protected async executeTick(): Promise<void> {
    const probe = this.probeFactory.createSchedulerProbe({
      baseBackoff: this.baseBackoff,
      maxBackoff: this.maxBackoff,
      maxRetriggerAttempts: this.maxRetriggerAttempts,
    });
    let item: QueueItem | undefined;
    try {
      await this.pruner.prune();
      probe.pruningCompleted();

      await this.prisma.$transaction(async (tx) => {
        const resolvedCount = await this.queue.resolveStaleRetriggered(this.maxRetriggerAgeMs, tx);
        if (resolvedCount > 0) {
          probe.staleRetriggeredResolved(resolvedCount);
        }
      });

      if (await this.systemState.isSchedulerPaused(undefined)) {
        probe.schedulerPaused();
        return;
      }

      const pendingAck = await this.pullRequests.findPendingAcknowledgement();
      if (pendingAck) {
        const elapsed = Date.now() - pendingAck.last_review_requested_at.getTime();
        if (elapsed < this.retriggerSpacingMs) {
          probe.tickSkippedAwaitingAcknowledgement();
          return;
        }
      }

      const nextReviewAvailableAt = await this.systemState.getNextReviewAvailableAt(undefined);
      if (nextReviewAvailableAt !== undefined && nextReviewAvailableAt.getTime() > Date.now()) {
        probe.tickSkippedCooldown();
        return;
      }

      item = await this.selectNextEligibleItem(probe);
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
          if (err.code === RabbitMaximizerErrorCodes.RETRIGGER_ITEM_NOT_PENDING) {
            this.log.warn({ fn: 'Scheduler.executeTick', queueId: item!.id, error: err }, 'Item not pending at trigger time; skipping');
          } else if (err instanceof StaleCommentRescheduledError) {
            // Source comment was replaced by a newer rate-limit comment: reschedule with
            // updated source_comment data. Not a failure.
            await this.queue.reschedule(item!.id, err.sourceComment, err.originalSource.url, tx);
            const existing = await this.systemState.getNextReviewAvailableAt(tx);
            const nextAvailable = existing !== undefined && existing > err.rescheduleEarliest ? existing : err.rescheduleEarliest;
            await this.systemState.setNextReviewAvailableAt(nextAvailable, tx);
            probe.triggerFailed(err, tx);
          } else if (err.code === RabbitMaximizerErrorCodes.RETRIGGER_STALE_COMMENT_SKIP) {
            await this.queue.markResolved(item!.id, Resolution.StaleComment, tx);
            probe.triggerFailed(err, tx);
          } else {
            if (item!.attempts >= this.maxRetriggerAttempts) {
              await this.queue.markResolved(item!.id, Resolution.Failed, tx);
              await probe.maxRetriggersExceeded(item!.attempts, tx);
            } else {
              await this.queue.backoff(item!.id, tx);
              probe.triggerFailed(err, tx);
            }
          }
        });
        return;
      }

      // Cap total retriggers to prevent indefinite retrigger loops.
      // Attempts are incremented on both success and failure so the item
      // eventually resolves even when every retrigger succeeds.
      const newAttempts = item_!.attempts + 1;
      if (newAttempts >= this.maxRetriggerAttempts) {
        await this.prisma.$transaction(async (tx) => {
          await this.queue.markResolved(item_!.id, Resolution.Failed, tx);
          await probe.maxRetriggersExceeded(newAttempts, tx);
        });
      } else {
        await this.prisma.$transaction(async (tx) => {
          await this.queue.incrementAttempts(item_!.id, newAttempts, tx);
        });
      }
    } catch (err: unknown) {
      if (!item) {
        probe.tickFailed(err);
        return;
      }

      const error = err as { status?: number };

      if (isTerminalHttpStatus(error.status)) {
        await this.prisma.$transaction(async (tx) => {
          await this.queue.markResolved(item!.id, Resolution.Failed, tx);
          await probe.prDeleted(error.status!, tx);
        });
        return;
      }

      const backoffMs = computeSchedulerBackoff(item!.attempts, this.baseBackoff, this.maxBackoff);

      await this.prisma.$transaction(async (tx) => {
        if (item!.attempts >= this.maxRetriggerAttempts) {
          await this.queue.markResolved(item!.id, Resolution.Failed, tx);
          await probe.maxRetriggersExceeded(item!.attempts, tx);
        } else {
          await this.queue.backoff(item!.id, tx);
          probe.backedOff(backoffMs, item!.attempts, err, tx);
        }
      });
    } finally {
      try {
        await this.systemState.setLastSchedulerTickAt(new Date(), undefined);
      } catch (error) {
        this.log.error({ fn: 'Scheduler.executeTick', error }, 'Failed to persist scheduler heartbeat');
      }
    }
  }

  private async selectNextEligibleItem(probe: SchedulerProbe): Promise<QueueItem | undefined> {
    const eligible = (await this.queueOrder.getEffectiveOrder()).filter((item) => item.status === QueueStatus.pending);

    for (const candidate of eligible) {
      const prState = await this.prStateFetcher.fetch(candidate.repo_full_name, candidate.pr_number, 'Scheduler.selectNextEligibleItem');
      if (prState === undefined) {
        continue;
      }
      if (isPRMerged(prState)) {
        await this.resolveTerminalCandidate(candidate, Resolution.PrMerged, PrState.merged, probe);
        continue;
      }
      if (isPRClosedWithoutMerge(prState)) {
        await this.resolveTerminalCandidate(candidate, Resolution.PrClosedWithoutMerge, PrState.closed, probe);
        continue;
      }
      return candidate;
    }

    return undefined;
  }

  private async resolveTerminalCandidate(candidate: QueueItem, resolution: Resolution, prState: PrState, probe: SchedulerProbe): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.queue.markResolved(candidate.id, resolution, tx);
      await probe.prClosedDuringScan(candidate.repo_full_name, candidate.pr_number, prState, tx);
    });
  }
}
