import type { EventRepository } from '../db/index.js';
import { EventType, PrState, Resolution, ReviewDetectionMethod } from '../domain.js';
import type { CoderabbitReviewVerdictState, QueueItem } from '../types/index.js';
import { toReviewEventType } from '../utils/index.js';

import { getEventTraceAttributes } from './getEventTraceAttributes.js';

import type { Logger } from '@couimet/logger-contract';
import type { Prisma } from '@prisma/client';

export class ReviewDetectorProbe {
  private item: QueueItem | undefined;

  constructor(
    private readonly events: EventRepository,
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

  resolutionLostRace(resolution: Resolution): void {
    this.log.warn(
      {
        fn: 'ReviewDetectorProbe.resolutionLostRace',
        repo: this.item!.repo_full_name,
        pr: this.item!.pr_number,
        queueId: this.item!.id,
        resolution,
      },
      'Item was no longer retriggered; another writer resolved it first — skipping resolution',
    );
  }

  runAdopted(runId: string): void {
    this.log.info(
      { fn: 'ReviewDetectorProbe.runAdopted', repo: this.item!.repo_full_name, pr: this.item!.pr_number, queueId: this.item!.id, runId },
      'Re-edited skip comment adopted a new CodeRabbit run in place',
    );
  }

  runAdoptionLostRace(runId: string): void {
    this.log.warn(
      { fn: 'ReviewDetectorProbe.runAdoptionLostRace', repo: this.item!.repo_full_name, pr: this.item!.pr_number, queueId: this.item!.id, runId },
      'Run adoption lost the race; the item was resolved or its run changed',
    );
  }

  async reviewedViaFallback(tx: Prisma.TransactionClient): Promise<void> {
    await this.events.record(
      {
        type: EventType.coderabbit_review_approved,
        repo_full_name: this.item!.repo_full_name,
        pr_number: this.item!.pr_number,
        ...getEventTraceAttributes(),
        payload: {
          detected_via: ReviewDetectionMethod.LastReviewAtFallback,
        },
      },
      tx,
    );
    this.log.info(
      {
        fn: 'ReviewDetectorProbe.reviewedViaFallback',
        repo: this.item!.repo_full_name,
        pr: this.item!.pr_number,
        queueId: this.item!.id,
      },
      'Review detected via last_coderabbit_review_at fallback',
    );
  }

  async reviewed(
    commentUrl: string,
    verdictState: CoderabbitReviewVerdictState,
    detectedVia: ReviewDetectionMethod,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const eventType = toReviewEventType(verdictState);
    await this.events.record(
      {
        type: eventType,
        repo_full_name: this.item!.repo_full_name,
        pr_number: this.item!.pr_number,
        ...getEventTraceAttributes(),
        payload: {
          coderabbit_comment_url: commentUrl,
          verdict_state: verdictState,
          detected_via: detectedVia,
        },
      },
      tx,
    );
    this.log.info(
      {
        fn: 'ReviewDetectorProbe.reviewed',
        repo: this.item!.repo_full_name,
        pr: this.item!.pr_number,
        queueId: this.item!.id,
        eventType,
        commentUrl,
      },
      'Review detected',
    );
  }

  prClosedResolved(prState: PrState): void {
    this.log.info(
      { fn: 'ReviewDetectorProbe.prClosedResolved', repo: this.item!.repo_full_name, pr: this.item!.pr_number, queueId: this.item!.id, prState },
      'PR is closed or merged; auto-resolving retriggered queue item',
    );
  }

  editDetectionFailed(error: unknown): void {
    this.log.warn(
      { fn: 'ReviewDetectorProbe.editDetectionFailed', repo: this.item!.repo_full_name, pr: this.item!.pr_number, queueId: this.item!.id, error },
      'Edit detection failed; skipping retrigger check for this item',
    );
  }

  caughtError(err: unknown): void {
    this.log.warn(
      { fn: 'ReviewDetectorProbe.caughtError', repo: this.item!.repo_full_name, pr: this.item!.pr_number, queueId: this.item!.id, error: err },
      'Review detection tick failed; will retry on next interval',
    );
  }
}
