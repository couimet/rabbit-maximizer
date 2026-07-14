import type { EventRepository } from '../db/eventRepository.js';
import type { ObservationContext } from '../observability/observationContext.js';
import { EventType } from '../types/index.js';

import type { Logger } from '@couimet/logger-contract';
import type { Prisma, ReviewQueue } from '@prisma/client';

export class MarkQueueItemReviewedProbe {
  constructor(
    private readonly uuid: string,
    private readonly events: EventRepository,
    private readonly observation: ObservationContext,
    private readonly log: Logger,
  ) {}

  queueItemNotFound(): void {
    this.log.warn({ fn: 'MarkQueueItemReviewedProbe.queueItemNotFound', uuid: this.uuid }, 'Queue item not found for mark-reviewed');
  }

  async queueItemMarkedReviewed(row: ReviewQueue, tx: Prisma.TransactionClient): Promise<void> {
    await this.events.record(
      {
        type: EventType.coderabbit_review_approved,
        repo_full_name: row.repo_full_name,
        pr_number: row.pr_number,
        correlation_id: this.observation.correlationId,
        request_id: this.observation.requestId,
        version: this.observation.version,
        payload: {
          coderabbit_comment_url: row.retrigger_comment_url ?? undefined,
        },
      },
      tx,
    );
    this.log.debug({ fn: 'MarkQueueItemReviewedProbe.queueItemMarkedReviewed', uuid: this.uuid, id: row.id }, 'Marked review reviewed by UUID');
  }
}
