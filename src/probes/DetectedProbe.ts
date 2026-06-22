import type { EventRepository } from '../db/eventRepository.js';
import type { ObservationContext } from '../observability/observationContext.js';
import { type EventLogEntry, EventType } from '../types/index.js';

import { EventProbe } from './EventProbe.js';

import type { Logger } from '@couimet/logger-contract';
import type { Prisma } from '@prisma/client';

export interface DetectedProbeContext {
  readonly repo_full_name: string;
  readonly pr_number: number;
  readonly source_ts?: Date;
  readonly source_comment_url?: string;
}

export class DetectedProbe extends EventProbe {
  private readonly loggingCtx;

  constructor(
    private readonly context: DetectedProbeContext,
    private readonly eventRepository: EventRepository,
    observation: ObservationContext,
    log: Logger,
  ) {
    super(observation, log);
    this.loggingCtx = {
      fn: 'DetectedProbe',
      repo: context.repo_full_name,
      pr: context.pr_number,
    };
  }

  processStarted(): Promise<void> {
    this.log.debug(this.loggingCtx, 'Rate-limit comment detected');
    return Promise.resolve();
  }

  async processCompleted(tx?: Prisma.TransactionClient): Promise<EventLogEntry> {
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

    this.log.info({ ...this.loggingCtx, eventUuid: event.uuid }, 'Detected event recorded');
    return event;
  }
}
