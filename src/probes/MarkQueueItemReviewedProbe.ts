import type { Logger } from '@couimet/logger-contract';
import type { ReviewQueue } from '@prisma/client';

export class MarkQueueItemReviewedProbe {
  constructor(
    private readonly uuid: string,
    private readonly log: Logger,
  ) {}

  queueItemNotFound(): void {
    this.log.warn({ fn: 'MarkQueueItemReviewedProbe.queueItemNotFound', uuid: this.uuid }, 'Queue item not found for mark-reviewed');
  }

  queueItemMarkedReviewed(row: ReviewQueue): void {
    this.log.debug({ fn: 'MarkQueueItemReviewedProbe.queueItemMarkedReviewed', uuid: this.uuid, id: row.id }, 'Marked review reviewed by UUID');
  }
}
