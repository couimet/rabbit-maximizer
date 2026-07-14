import type { EventRepository } from '../db/eventRepository.js';
import type { RabbitMaximizerError } from '../errors/RabbitMaximizerError.js';
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

  awaitingAcknowledgement(spacingSec: number): void {
    this.log.debug({ fn: 'SchedulerProbe.awaitingAcknowledgement', spacingSec }, 'Awaiting CodeRabbit acknowledgement before retriggering');
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
        correlation_id: this.observation.correlationId,
        request_id: this.observation.requestId,
        version: this.observation.version,
        payload: { source_comment_url: this.item!.source_comment_url, retriggered_comment_url: retriggeredCommentUrl },
      },
      tx,
    );
    this.log.info(
      { fn: 'SchedulerProbe.retriggered', repo: this.item!.repo_full_name, pr: this.item!.pr_number, queueId: this.item!.id },
      'Review retriggered',
    );
  }

  async prClosedOrMerged(status: number, tx: Prisma.TransactionClient): Promise<void> {
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

  backedOff(backoffMs: number, attempts: number, error: unknown, _tx: Prisma.TransactionClient): void {
    this.log.warn(
      { fn: 'SchedulerProbe.backedOff', repo: this.item!.repo_full_name, pr: this.item!.pr_number, queueId: this.item!.id, backoffMs, attempts, error },
      'Post retrigger failed; rescheduled with backoff',
    );
  }

  triggerFailed(error: RabbitMaximizerError, _tx: Prisma.TransactionClient): void {
    const item = this.item!;

    if (error.code === RabbitMaximizerErrorCodes.RETRIGGER_STALE_COMMENT_RESCHEDULE) {
      const details = error.details as { notBefore: string; sourceComment: { commentId: number; commentUrl: string } };
      const newNotBefore = new Date(details.notBefore);
      this.log.info(
        { fn: 'SchedulerProbe.rescheduled', repo: item.repo_full_name, pr: item.pr_number, queueId: item.id, newNotBefore, error },
        'Stale source comment replaced; rescheduled with updated not_before',
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
