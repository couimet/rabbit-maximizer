import type { EventRepository } from '../db/eventRepository.js';
import type { ObservationContext } from '../observability/observationContext.js';
import { BypassReason, type EventLogEntry, EventType } from '../types/index.js';

import { recordBypassEvent } from './recordBypassEvent.js';

import type { Logger } from '@couimet/logger-contract';
import type { Prisma } from '@prisma/client';

export interface DetectedProbeContext {
  readonly repo_full_name: string;
  readonly pr_number: number;
  readonly source_ts?: Date;
  readonly source_comment_url?: string;
}

export class DetectedProbe {
  private readonly loggingCtx;

  constructor(
    private readonly context: DetectedProbeContext,
    private readonly eventRepository: EventRepository,
    private readonly observation: ObservationContext,
    private readonly log: Logger,
  ) {
    this.loggingCtx = {
      fn: 'DetectedProbe',
      repo: context.repo_full_name,
      pr: context.pr_number,
    };
  }

  private async recordBypass(tx: Prisma.TransactionClient, reason: BypassReason, message: string): Promise<EventLogEntry> {
    const event = await recordBypassEvent({
      events: this.eventRepository,
      tx,
      reason,
      observation: this.observation,
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
        correlation_id: this.observation.correlationId,
        request_id: this.observation.requestId,
        version: this.observation.version,
        payload: {
          source_ts: this.context.source_ts,
          source_comment_url: this.context.source_comment_url,
        },
      },
      tx,
    );

    this.log.info({ ...this.loggingCtx, eventUuid: event.uuid }, 'Review-limit comment detected and enqueued');
    return event;
  }

  prMerged(tx: Prisma.TransactionClient): Promise<EventLogEntry> {
    return this.recordBypass(tx, BypassReason.prMerged, 'Review-limit comment bypassed: PR already merged');
  }

  prClosedWithoutMerge(tx: Prisma.TransactionClient): Promise<EventLogEntry> {
    return this.recordBypass(tx, BypassReason.prClosedWithoutMerge, 'Review-limit comment bypassed: PR closed without merge');
  }

  alreadyQueued(): void {
    this.log.info(this.loggingCtx, 'Review-limit comment already queued; skipping');
  }

  alreadyProcessed(existingUuids: string[]): void {
    this.log.info({ ...this.loggingCtx, existingUuids }, 'Review-limit comment already processed; skipping');
  }
}
