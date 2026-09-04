import type { EventRepository } from '../db/index.js';
import { DismissalReason, EventType, PrState, SkipReason } from '../domain.js';
import { type RabbitMaximizerError, RabbitMaximizerErrorCodes } from '../errors/index.js';
import type { QueueItem } from '../types/index.js';
import { computeSchedulerBackoff, dismissalReasonFromPrState } from '../utils/index.js';

import { getEventTraceAttributes } from './getEventTraceAttributes.js';

import type { Logger } from '@couimet/logger-contract';
import type { Prisma } from '@prisma/client';

export interface CreateSchedulerProbeParams {
  baseBackoff: number;
  maxBackoff: number;
  maxRetriggerAttempts: number;
}

export class SchedulerProbe {
  private item: QueueItem | undefined;

  constructor(
    private readonly baseBackoff: number,
    private readonly maxBackoff: number,
    private readonly maxRetriggerAttempts: number,
    private readonly events: EventRepository,
    private readonly log: Logger,
  ) {}

  withItem(item: QueueItem): void {
    this.item = item;
  }

  staleRetriggeredResolved(count: number): void {
    this.log.info({ fn: 'SchedulerProbe.staleRetriggeredResolved', count }, 'Resolved stale retriggered items');
  }

  pruningCompleted(): void {
    this.log.debug({ fn: 'SchedulerProbe.pruningCompleted' }, 'Pruning completed');
  }
  schedulerPaused(): void {
    this.log.debug({ fn: 'SchedulerProbe.schedulerPaused' }, 'Scheduler is paused; skipping tick');
  }
  tickSkippedAwaitingAcknowledgement(): void {
    this.log.info({ fn: 'SchedulerProbe.tickSkippedAwaitingAcknowledgement' }, 'Awaiting CodeRabbit acknowledgement; skipping tick');
  }
  tickSkippedCooldown(): void {
    this.log.debug({ fn: 'SchedulerProbe.tickSkippedCooldown' }, 'Tick skipped: review cooldown active');
  }
  retriggerSkipped(item: QueueItem, reason: SkipReason): void {
    this.log.debug(
      { fn: 'SchedulerProbe.retriggerSkipped', repo: item.repo_full_name, pr: item.pr_number, queueId: item.id, reason },
      'Retrigger skipped for this candidate',
    );
  }
  noItemsDue(): void {
    this.log.debug({ fn: 'SchedulerProbe.noItemsDue' }, 'No items due for retrigger');
  }
  scanBudgetExhausted(): void {
    this.log.debug({ fn: 'SchedulerProbe.scanBudgetExhausted' }, 'PR-state scan budget exhausted; deferring remaining candidates to a later tick');
  }

  tickFailed(error: unknown): void {
    this.log.warn({ fn: 'SchedulerProbe.tickFailed', error }, 'executeTick failed before item was fetched');
  }

  async retriggered(retriggeredCommentUrl: string, tx: Prisma.TransactionClient): Promise<void> {
    await this.events.record(
      {
        type: EventType.retriggered,
        repo_full_name: this.item!.repo_full_name,
        pr_number: this.item!.pr_number,
        ...getEventTraceAttributes(),
        payload: { source_comment_url: this.item!.source_comment_url, retriggered_comment_url: retriggeredCommentUrl },
      },
      tx,
    );
    this.log.info(
      { fn: 'SchedulerProbe.retriggered', repo: this.item!.repo_full_name, pr: this.item!.pr_number, queueId: this.item!.id },
      'Review retriggered',
    );
  }

  async prClosedDuringScan(repo: string, pr: number, prState: PrState, tx: Prisma.TransactionClient): Promise<void> {
    const reason = dismissalReasonFromPrState(prState);
    await this.events.record(
      {
        type: EventType.dismissed,
        repo_full_name: repo,
        pr_number: pr,
        ...getEventTraceAttributes(),
        payload: { reason },
      },
      tx,
    );
    this.log.info({ fn: 'SchedulerProbe.prClosedDuringScan', repo, pr, prState, reason }, 'PR closed or merged during scheduler scan; dismissed');
  }

  async prDeleted(status: number, tx: Prisma.TransactionClient): Promise<void> {
    await this.events.record(
      {
        type: EventType.dismissed,
        repo_full_name: this.item!.repo_full_name,
        pr_number: this.item!.pr_number,
        ...getEventTraceAttributes(),
        payload: { reason: DismissalReason.prDeleted },
      },
      tx,
    );
    this.log.info(
      { fn: 'SchedulerProbe.prDeleted', repo: this.item!.repo_full_name, pr: this.item!.pr_number, queueId: this.item!.id, status },
      'PR not found (deleted); dismissed',
    );
  }

  async maxRetriggersExceeded(retriggerCount: number, tx: Prisma.TransactionClient): Promise<void> {
    await this.events.record(
      {
        type: EventType.failed,
        repo_full_name: this.item!.repo_full_name,
        pr_number: this.item!.pr_number,
        ...getEventTraceAttributes(),
        payload: { reason: 'max_retrigger_attempts_exceeded', retrigger_count: retriggerCount, max: this.maxRetriggerAttempts },
      },
      tx,
    );
    this.log.warn(
      {
        fn: 'SchedulerProbe.maxRetriggersExceeded',
        repo: this.item!.repo_full_name,
        pr: this.item!.pr_number,
        queueId: this.item!.id,
        retriggerCount,
        max: this.maxRetriggerAttempts,
      },
      'Max retrigger attempts exceeded; marking failed',
    );
  }

  backedOff(backoffMs: number, attempts: number, error: unknown, _tx: Prisma.TransactionClient): void {
    this.log.warn(
      { fn: 'SchedulerProbe.backedOff', repo: this.item!.repo_full_name, pr: this.item!.pr_number, queueId: this.item!.id, backoffMs, attempts, error },
      'Post retrigger failed; rescheduled with backoff',
    );
  }

  triggerFailed(error: RabbitMaximizerError, _tx: Prisma.TransactionClient): void {
    const item = this.item!;

    if (error.code === RabbitMaximizerErrorCodes.RETRIGGER_STALE_COMMENT_RESCHEDULE) {
      const details = error.details as { rescheduleEarliest: string; sourceComment: { commentId: number; commentUrl: string } };
      const rescheduleEarliest = new Date(details.rescheduleEarliest);
      this.log.info(
        { fn: 'SchedulerProbe.rescheduled', repo: item.repo_full_name, pr: item.pr_number, queueId: item.id, rescheduleEarliest, error },
        'Stale source comment replaced; rescheduled with updated time',
      );
    } else {
      const backoffMs = computeSchedulerBackoff(item.attempts, this.baseBackoff, this.maxBackoff);
      this.log.warn(
        { fn: 'SchedulerProbe.skipped', repo: item.repo_full_name, pr: item.pr_number, queueId: item.id, backoffMs, error },
        `Stale source comment with no replacement; rescheduled with backoff (code: ${error.code})`,
      );
    }
  }
}
