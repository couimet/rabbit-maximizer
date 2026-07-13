import type { EventRepository } from '../db/eventRepository.js';
import type { PullRequestRepository } from '../db/pullRequestRepository.js';
import type { QueueRepository } from '../db/queueRepository.js';
import type { ObservationContext } from '../observability/observationContext.js';
import { EventType, type QueueItem } from '../types/index.js';

import type { Logger } from '@couimet/logger-contract';
import type { Prisma } from '@prisma/client';

export class ReviewRetriggerProbe {
  constructor(
    private readonly item: QueueItem,
    private readonly queue: QueueRepository,
    private readonly pullRequests: PullRequestRepository,
    private readonly events: EventRepository,
    private readonly observation: ObservationContext,
    private readonly log: Logger,
  ) {}

  staleCommentSkipped(): void {
    this.log.warn(
      { fn: 'ReviewRetriggerProbe.staleCommentSkipped', repo: this.item.repo_full_name, pr: this.item.pr_number, queueId: this.item.id },
      'No replacement rate-limit comment found',
    );
  }

  staleCommentReplacementDeleted(commentId: number): void {
    this.log.warn(
      { fn: 'ReviewRetriggerProbe.staleCommentReplacementDeleted', repo: this.item.repo_full_name, pr: this.item.pr_number, queueId: this.item.id, commentId },
      'Replacement comment was deleted before fetch',
    );
  }

  staleCommentRescheduled(notBefore: Date): void {
    this.log.info(
      { fn: 'ReviewRetriggerProbe.staleCommentRescheduled', repo: this.item.repo_full_name, pr: this.item.pr_number, queueId: this.item.id, notBefore },
      'Stale source comment replaced; rescheduled with updated not_before',
    );
  }

  async reviewRetriggered(retriggeredCommentUrl: string, cooldownUntil: Date, tx: Prisma.TransactionClient): Promise<void> {
    await this.queue.markRetriggered(this.item.id, cooldownUntil, retriggeredCommentUrl, tx);
    await this.pullRequests.recordRetrigger(this.item.pull_request_id, tx);
    await this.events.record(
      {
        type: EventType.retriggered,
        repo_full_name: this.item.repo_full_name,
        pr_number: this.item.pr_number,
        correlation_id: this.observation.correlationId,
        request_id: this.observation.requestId,
        version: this.observation.version,
        payload: { source_comment_url: this.item.source_comment_url, retriggered_comment_url: retriggeredCommentUrl },
      },
      tx,
    );
    this.log.info(
      { fn: 'ReviewRetriggerProbe.reviewRetriggered', repo: this.item.repo_full_name, pr: this.item.pr_number, queueId: this.item.id },
      'Review retriggered',
    );
  }
}
