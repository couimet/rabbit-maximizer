import type { EventRepository } from '../db/index.js';
import { DismissalReason, EventType } from '../domain.js';
import type { AlreadyReviewedComment, CoderabbitReviewVerdictState, EventLogEntry } from '../types/index.js';
import { toReviewEventType } from '../utils/index.js';

import { getEventTraceAttributes } from './getEventTraceAttributes.js';
import { recordDismissalEvent } from './index.js';

import type { Logger } from '@couimet/logger-contract';
import type { Prisma } from '@prisma/client';

export interface DetectedProbeContext {
  readonly repo_full_name: string;
  readonly pr_number: number;
  readonly source_ts: Date;
  readonly source_comment_url: string;
  readonly coderabbit_run_id: string | undefined;
}

export class DetectedProbe {
  private readonly loggingCtx;

  constructor(
    private readonly context: DetectedProbeContext,
    private readonly eventRepository: EventRepository,
    private readonly log: Logger,
  ) {
    this.loggingCtx = {
      fn: 'DetectedProbe',
      repo: context.repo_full_name,
      pr: context.pr_number,
      ...(context.coderabbit_run_id !== undefined ? { coderabbit_run_id: context.coderabbit_run_id } : {}),
    };
  }

  private async recordDismissal(tx: Prisma.TransactionClient, reason: DismissalReason, message: string): Promise<EventLogEntry> {
    const event = await recordDismissalEvent({
      events: this.eventRepository,
      tx,
      reason,
      repo_full_name: this.context.repo_full_name,
      pr_number: this.context.pr_number,
    });
    this.log.info({ ...this.loggingCtx, eventUuid: event.uuid }, message);
    return event;
  }

  detected(): Promise<void> {
    this.log.debug(this.loggingCtx, 'Review-limit comment detected');
    return Promise.resolve();
  }

  async enqueued(tx: Prisma.TransactionClient): Promise<EventLogEntry> {
    const event = await this.eventRepository.record(
      {
        type: EventType.detected,
        repo_full_name: this.context.repo_full_name,
        pr_number: this.context.pr_number,
        ...getEventTraceAttributes(),
        payload: {
          source_ts: this.context.source_ts,
          source_comment_url: this.context.source_comment_url,
          coderabbit_run_id: this.context.coderabbit_run_id,
        },
      },
      tx,
    );

    this.log.info({ ...this.loggingCtx, eventUuid: event.uuid }, 'Review-limit comment detected and enqueued');
    return event;
  }

  prMerged(tx: Prisma.TransactionClient): Promise<EventLogEntry> {
    return this.recordDismissal(tx, DismissalReason.prMerged, 'Review-limit comment dismissed: PR already merged');
  }

  prClosedWithoutMerge(tx: Prisma.TransactionClient): Promise<EventLogEntry> {
    return this.recordDismissal(tx, DismissalReason.prClosedWithoutMerge, 'Review-limit comment dismissed: PR closed without merge');
  }

  prNotRegistered(tx: Prisma.TransactionClient): Promise<EventLogEntry> {
    return this.recordDismissal(tx, DismissalReason.prNotRegistered, 'Review-limit comment dismissed: PR not yet registered by scanner');
  }

  alreadyQueued(): void {
    this.log.info(this.loggingCtx, 'Review-limit comment already queued; skipping');
  }

  async skipped(tx: Prisma.TransactionClient): Promise<EventLogEntry> {
    const event = await this.eventRepository.record(
      {
        type: EventType.coderabbit_review_skipped,
        repo_full_name: this.context.repo_full_name,
        pr_number: this.context.pr_number,
        ...getEventTraceAttributes(),
        payload: {
          source_ts: this.context.source_ts,
          comment_url: this.context.source_comment_url,
          skip_reason: 'CodeRabbit explicitly skipped this review',
          coderabbit_run_id: this.context.coderabbit_run_id,
        },
      },
      tx,
    );
    this.log.info({ ...this.loggingCtx, eventUuid: event.uuid }, 'CodeRabbit skip comment encountered');
    return event;
  }

  async verdictResolved(tx: Prisma.TransactionClient, verdictState: CoderabbitReviewVerdictState): Promise<EventLogEntry> {
    const event = await this.eventRepository.record(
      {
        type: toReviewEventType(verdictState),
        repo_full_name: this.context.repo_full_name,
        pr_number: this.context.pr_number,
        ...getEventTraceAttributes(),
        payload: {
          coderabbit_comment_url: this.context.source_comment_url,
          source_ts: this.context.source_ts,
          verdict_state: verdictState,
          coderabbit_run_id: this.context.coderabbit_run_id,
        },
      },
      tx,
    );
    this.log.info({ ...this.loggingCtx, eventUuid: event.uuid }, 'CodeRabbit review verdict detected; skipping enqueue');
    return event;
  }

  alreadySkipped(existingStatus: string): void {
    this.log.warn({ ...this.loggingCtx, existingStatus }, 'Skipped comment already recorded; skipping');
  }

  alreadyReviewed(comment: AlreadyReviewedComment): void {
    this.log.info({ ...this.loggingCtx, commentId: comment.comment_id, commentUrl: comment.url }, 'PR already reviewed by CodeRabbit; skipping enqueue');
  }
}
