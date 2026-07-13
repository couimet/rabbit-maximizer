import type { EventRepository } from '../db/eventRepository.js';
import type { CompletedReview } from '../github/types/CompletedReview.js';
import type { ObservationContext } from '../observability/observationContext.js';
import { EventType, type QueueItem } from '../types/index.js';

import type { Logger } from '@couimet/logger-contract';
import type { Prisma } from '@prisma/client';

export class ReviewDetectorProbe {
  private item: QueueItem | undefined;

  constructor(
    private readonly events: EventRepository,
    private readonly observation: ObservationContext,
    private readonly log: Logger,
  ) {}

  withItem(item: QueueItem): void {
    this.item = item;
  }

  noRetriggeredItemFound(): void {
    this.log.info({ fn: 'ReviewDetectorProbe.noRetriggeredItemFound' }, 'No retriggered items to check');
  }

  noCompletedReviewFound(): void {
    this.log.debug(
      { fn: 'ReviewDetectorProbe.noCompletedReviewFound', repo: this.item!.repo_full_name, pr: this.item!.pr_number, queueId: this.item!.id },
      'No completed review found; will retry on next tick',
    );
  }

  async completed(completedReview: CompletedReview, tx: Prisma.TransactionClient): Promise<void> {
    await this.events.record(
      {
        type: EventType.completed,
        repo_full_name: this.item!.repo_full_name,
        pr_number: this.item!.pr_number,
        correlation_id: this.observation.correlationId,
        request_id: this.observation.requestId,
        version: this.observation.version,
        payload: {
          retriggered_comment_url: completedReview.htmlUrl,
          review_id: completedReview.reviewId,
        },
      },
      tx,
    );
    this.log.info(
      {
        fn: 'ReviewDetectorProbe.completed',
        repo: this.item!.repo_full_name,
        pr: this.item!.pr_number,
        queueId: this.item!.id,
        reviewUrl: completedReview.htmlUrl,
        reviewId: completedReview.reviewId,
      },
      'Completed review detected',
    );
  }

  caughtError(err: unknown): void {
    this.log.warn(
      { fn: 'ReviewDetectorProbe.caughtError', repo: this.item!.repo_full_name, pr: this.item!.pr_number, queueId: this.item!.id, error: err },
      'Review detection tick failed; will retry on next interval',
    );
  }
}
