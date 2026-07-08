import type { EventRepository } from '../db/eventRepository.js';
import type { ObservationContext } from '../observability/observationContext.js';
import { EventType } from '../types/index.js';

import type { Logger } from '@couimet/logger-contract';
import type { Prisma, ReviewQueue } from '@prisma/client';

export class MarkQueueItemCompletedProbe {
  constructor(
    private readonly uuid: string,
    private readonly events: EventRepository,
    private readonly observation: ObservationContext,
    private readonly log: Logger,
  ) {}

  queueItemNotFound(): void {
    this.log.warn({ fn: 'MarkQueueItemCompletedProbe.queueItemNotFound', uuid: this.uuid }, 'Queue item not found for mark-completed');
  }

  async queueItemMarkedCompleted(row: ReviewQueue, tx: Prisma.TransactionClient): Promise<void> {
    await this.events.record(
      {
        type: EventType.completed,
        repo_full_name: row.repo_full_name,
        pr_number: row.pr_number,
        correlation_id: this.observation.correlationId,
        version: this.observation.version,
        payload: {
          retriggered_comment_url: row.retrigger_comment_url ?? undefined,
        },
      },
      tx,
    );
    this.log.debug({ fn: 'MarkQueueItemCompletedProbe.queueItemMarkedCompleted', uuid: this.uuid, id: row.id }, 'Marked review completed by UUID');
  }
}
