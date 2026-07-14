import type { EventRepository } from '../db/eventRepository.js';
import type { ObservationContext } from '../observability/observationContext.js';
import { EventType } from '../types/index.js';

import type { Logger } from '@couimet/logger-contract';
import type { Prisma } from '@prisma/client';

export class EnqueueProbe {
  constructor(
    private readonly events: EventRepository,
    private readonly observation: ObservationContext,
    private readonly tx: Prisma.TransactionClient,
    private readonly log: Logger,
  ) {}

  recentlyRetriggered(repo: string, pr: number): void {
    this.log.debug({ fn: 'EnqueueProbe.recentlyRetriggered', repo, pr }, 'PR was recently retriggered; skipping');
  }

  async enqueued(params: { repo: string; pr: number; notBefore: Date; newWait: number }): Promise<void> {
    const event = await this.events.record(
      {
        type: EventType.enqueued,
        repo_full_name: params.repo,
        pr_number: params.pr,
        correlation_id: this.observation.correlationId,
        request_id: this.observation.requestId,
        version: this.observation.version,
        payload: { not_before: params.notBefore, new_wait: params.newWait },
      },
      this.tx,
    );
    this.log.info({ fn: 'EnqueueProbe.enqueued', repo: params.repo, pr: params.pr, eventUuid: event.uuid }, 'Queue item enqueued');
  }

  alreadyQueued(repo: string, pr: number, status: string): void {
    this.log.debug({ fn: 'EnqueueProbe.alreadyQueued', repo, pr, status }, 'Already queued; returning existing row');
  }

  alreadyQueuedRescheduled(repo: string, pr: number, oldNotBefore: Date, newNotBefore: Date): void {
    this.log.debug({ fn: 'EnqueueProbe.alreadyQueuedRescheduled', repo, pr, oldNotBefore, newNotBefore }, 'Already queued; schedule updated on re-detection');
  }
}
