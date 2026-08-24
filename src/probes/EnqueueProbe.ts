import type { EventRepository } from '../db/index.js';
import { EventType } from '../domain.js';

import { getEventTraceAttributes } from './getEventTraceAttributes.js';

import type { Logger } from '@couimet/logger-contract';
import type { Prisma } from '@prisma/client';

export class EnqueueProbe {
  constructor(
    private readonly events: EventRepository,
    private readonly tx: Prisma.TransactionClient,
    private readonly log: Logger,
  ) {}

  recentlyRetriggered(repo: string, pr: number, commentId: number, runId: string | undefined): void {
    this.log.info(
      { fn: 'EnqueueProbe.recentlyRetriggered', repo, pr, commentId, ...(runId !== undefined ? { coderabbit_run_id: runId } : {}) },
      'PR was recently retriggered; skipping',
    );
  }

  retriggeredRunAdopted(repo: string, pr: number, queueItemId: number, commentId: number, previousRunId: string | undefined, runId: string): void {
    this.log.info(
      {
        fn: 'EnqueueProbe.retriggeredRunAdopted',
        repo,
        pr,
        queueItemId,
        commentId,
        ...(previousRunId !== undefined ? { previousCoderabbitRunId: previousRunId } : {}),
        coderabbit_run_id: runId,
      },
      'Same-comment retriggered item adopted the new CodeRabbit run in place',
    );
  }

  async enqueued(params: { repo: string; pr: number }): Promise<void> {
    const event = await this.events.record(
      {
        type: EventType.enqueued,
        repo_full_name: params.repo,
        pr_number: params.pr,
        ...getEventTraceAttributes(),
        payload: {},
      },
      this.tx,
    );
    this.log.info({ fn: 'EnqueueProbe.enqueued', repo: params.repo, pr: params.pr, eventUuid: event.uuid }, 'Queue item enqueued');
  }

  alreadyQueued(repo: string, pr: number, status: string): void {
    this.log.debug({ fn: 'EnqueueProbe.alreadyQueued', repo, pr, status }, 'Already queued; returning existing row');
  }

  recentlyResolved(repo: string, pr: number, existingUuid: string, sourceCommentId: number, resolvedAt: Date): void {
    const elapsedMs = Date.now() - resolvedAt.getTime();
    this.log.warn(
      { fn: 'EnqueueProbe.recentlyResolved', repo, pr, existingUuid, sourceCommentId, elapsedMs },
      'Loop detected: same source_comment_id re-enqueued within guard window',
    );
  }

  retriggeredReplaced(repo: string, pr: number, oldCommentId: number, newCommentId: number): void {
    this.log.info(
      { fn: 'EnqueueProbe.retriggeredReplaced', repo, pr, oldCommentId, newCommentId },
      'Recycled review-limit comment detected; updating retriggered item source comment to prevent duplicate items',
    );
  }

  resolvedReEnqueued(repo: string, pr: number, sourceCommentId: number): void {
    this.log.info({ fn: 'EnqueueProbe.resolvedReEnqueued', repo, pr, sourceCommentId }, 'Resolved item re-enqueued after comment edit');
  }

  resolvedNotEdited(repo: string, pr: number, sourceCommentId: number): void {
    this.log.debug({ fn: 'EnqueueProbe.resolvedNotEdited', repo, pr, sourceCommentId }, 'Resolved item exists for source comment; comment not edited');
  }
}
