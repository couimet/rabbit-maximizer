import type { EventRepository } from '../db/eventRepository.js';
import type { QueueRepository } from '../db/queueRepository.js';
import { RabbitMaximizerErrorCodes } from '../errors/RabbitMaximizerErrorCodes.js';
import type { ObservationContext } from '../observability/observationContext.js';
import { EventType, type QueueItem } from '../types/index.js';
import { computeSchedulerBackoff } from '../utils/computeSchedulerBackoff.js';

import type { Logger } from '@couimet/logger-contract';
import type { Prisma } from '@prisma/client';

export interface CreateSchedulerProbeParams {
  baseBackoff: number;
  maxBackoff: number;
}

export class SchedulerProbe {
  private item: QueueItem | undefined;

  constructor(
    private readonly baseBackoff: number,
    private readonly maxBackoff: number,
    private readonly queue: QueueRepository,
    private readonly events: EventRepository,
    private readonly observation: ObservationContext,
    private readonly log: Logger,
  ) {}

  withItem(item: QueueItem): void {
    this.item = item;
  }

  pruningCompleted(): void {
    this.log.debug({ fn: 'SchedulerProbe.pruningCompleted' }, 'Pruning completed');
  }
  schedulerPaused(): void {
    this.log.debug({ fn: 'SchedulerProbe.schedulerPaused' }, 'Scheduler is paused; skipping tick');
  }
  noItemsDue(): void {
    this.log.debug({ fn: 'SchedulerProbe.noItemsDue' }, 'No items due for retrigger');
  }

  tickFailed(error: unknown): void {
    this.log.warn({ fn: 'SchedulerProbe.tickFailed', error }, 'executeTick failed before item was fetched');
  }

  rescheduled(newNotBefore: Date): void {
    this.log.info(
      { fn: 'SchedulerProbe.rescheduled', repo: this.item!.repo_full_name, pr: this.item!.pr_number, queueId: this.item!.id, newNotBefore },
      'Stale source comment replaced; rescheduled with updated not_before',
    );
  }

  skipped(backoffMs: number): void {
    this.log.warn(
      { fn: 'SchedulerProbe.skipped', repo: this.item!.repo_full_name, pr: this.item!.pr_number, queueId: this.item!.id, backoffMs },
      'Stale source comment with no replacement; rescheduled with backoff',
    );
  }

  async retriggered(retriggeredCommentUrl: string, tx: Prisma.TransactionClient): Promise<void> {
    await this.events.record(
      {
        type: EventType.retriggered,
        repo_full_name: this.item!.repo_full_name,
        pr_number: this.item!.pr_number,
        correlation_id: this.observation.correlationId,
        request_id: this.observation.requestId,
        version: this.observation.version,
        payload: { source_comment_url: this.item!.source_comment_url, retriggered_comment_url: retriggeredCommentUrl },
      },
      tx,
    );
    this.log.info(
      { fn: 'SchedulerProbe.retriggered', repo: this.item!.repo_full_name, pr: this.item!.pr_number, queueId: this.item!.id },
      'Retrigger retriggered',
    );
  }

  async prClosedOrMerged(status: number, tx: Prisma.TransactionClient): Promise<void> {
    await this.queue.markFailed(this.item!.id, tx);
    await this.events.record(
      {
        type: EventType.failed,
        repo_full_name: this.item!.repo_full_name,
        pr_number: this.item!.pr_number,
        correlation_id: this.observation.correlationId,
        request_id: this.observation.requestId,
        version: this.observation.version,
        payload: { reason: 'PR closed or merged' },
      },
      tx,
    );
    this.log.info(
      { fn: 'SchedulerProbe.prClosedOrMerged', repo: this.item!.repo_full_name, pr: this.item!.pr_number, queueId: this.item!.id, status },
      'PR closed or merged; marked failed',
    );
  }

  async backedOff(backoffMs: number, attempts: number, error: unknown, tx: Prisma.TransactionClient): Promise<void> {
    await this.queue.backoff(this.item!.id, new Date(Date.now() + backoffMs), tx);
    this.log.warn(
      { fn: 'SchedulerProbe.backedOff', repo: this.item!.repo_full_name, pr: this.item!.pr_number, queueId: this.item!.id, backoffMs, attempts, error },
      'Post retrigger failed; rescheduled with backoff',
    );
  }

  async triggerFailed(result: { error: { code: string; details?: unknown } }, tx: Prisma.TransactionClient): Promise<void> {
    const item = this.item!;
    const err = result.error;

    if (err.code === RabbitMaximizerErrorCodes.RETRIGGER_STALE_COMMENT_RESCHEDULE) {
      const details = err.details as { notBefore: string; sourceComment: { commentId: number; commentUrl: string } };
      await this.queue.reschedule(item.id, new Date(details.notBefore), details.sourceComment, tx);
      this.rescheduled(new Date(details.notBefore));
    } else {
      const backoffMs = computeSchedulerBackoff(item.attempts, this.baseBackoff, this.maxBackoff);
      await this.queue.backoff(item.id, new Date(Date.now() + backoffMs), tx);
      this.skipped(backoffMs);
    }
  }
}
