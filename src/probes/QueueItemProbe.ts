import type { EventRepository } from '../db/eventRepository.js';
import type { PullRequestRepository } from '../db/pullRequestRepository.js';
import type { QueueRepository } from '../db/queueRepository.js';
import type { ObservationContext } from '../observability/observationContext.js';
import { BypassReason, EventType, type QueueItem } from '../types/index.js';

import { recordBypassEvent } from './recordBypassEvent.js';

import type { Logger } from '@couimet/logger-contract';
import type { Prisma } from '@prisma/client';

export class QueueItemProbe {
  constructor(
    private readonly item: QueueItem,
    private readonly queue: QueueRepository,
    private readonly pullRequests: PullRequestRepository,
    private readonly events: EventRepository,
    private readonly observation: ObservationContext,
    private readonly log: Logger,
  ) {}

  async processMergedBeforeRetrigger(tx: Prisma.TransactionClient): Promise<void> {
    await this.queue.markReviewed(this.item.id, tx);
    await this.pullRequests.recordReview(this.item.pull_request_id, tx);
    await recordBypassEvent({
      events: this.events,
      tx,
      reason: BypassReason.prMerged,
      observation: this.observation,
      repo_full_name: this.item.repo_full_name,
      pr_number: this.item.pr_number,
    });
    this.log.info(
      {
        fn: 'QueueItemProbe.processMergedBeforeRetrigger',
        repo: this.item.repo_full_name,
        pr: this.item.pr_number,
        queueId: this.item.id,
      },
      'Merged before retrigger; marked reviewed',
    );
  }

  async processClosedBeforeRetrigger(tx: Prisma.TransactionClient): Promise<void> {
    await this.queue.markFailed(this.item.id, tx);
    await recordBypassEvent({
      events: this.events,
      tx,
      reason: BypassReason.prClosedWithoutMerge,
      observation: this.observation,
      repo_full_name: this.item.repo_full_name,
      pr_number: this.item.pr_number,
    });
    this.log.info(
      {
        fn: 'QueueItemProbe.processClosedBeforeRetrigger',
        repo: this.item.repo_full_name,
        pr: this.item.pr_number,
        queueId: this.item.id,
      },
      'PR closed before retrigger; marked failed',
    );
  }

  async processRetriggered(retriggeredCommentUrl: string, cooldownUntil: Date, tx: Prisma.TransactionClient): Promise<void> {
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
        payload: {
          source_comment_url: this.item.source_comment_url!,
          retriggered_comment_url: retriggeredCommentUrl,
        },
      },
      tx,
    );
    this.log.info(
      {
        fn: 'QueueItemProbe.processRetriggered',
        repo: this.item.repo_full_name,
        pr: this.item.pr_number,
        queueId: this.item.id,
      },
      'Retrigger retriggered',
    );
  }
}
