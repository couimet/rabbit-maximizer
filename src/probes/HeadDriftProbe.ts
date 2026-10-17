import type { EventRepository } from '../db/index.js';
import { EventType } from '../domain.js';
import type { IgnoreRuleMatch, UnreviewedHeadPR } from '../types/index.js';

import { getEventTraceAttributes } from './getEventTraceAttributes.js';

import type { Logger } from '@couimet/logger-contract';
import type { Prisma } from '@prisma/client';

/**
 * Observability for one head-drift sweep. The already-reviewed and excluded outcomes
 * stay log lines because neither resolves anything, and the recovery writes the event
 * that explains why the PR re-entered the queue.
 */
export class HeadDriftProbe {
  private candidate: UnreviewedHeadPR | undefined;

  constructor(
    private readonly events: EventRepository,
    private readonly log: Logger,
  ) {}

  withCandidate(candidate: UnreviewedHeadPR): void {
    this.candidate = candidate;
  }

  noDriftFound(): void {
    this.log.debug({ fn: 'HeadDriftProbe.noDriftFound' }, 'No pull request carries an unreviewed head');
  }

  excluded(match: IgnoreRuleMatch): void {
    this.log.info(
      {
        fn: 'HeadDriftProbe.excluded',
        repo: this.candidate!.repoFullName,
        pr: this.candidate!.prNumber,
        field: match.field,
        pattern: match.pattern,
      },
      'Head-drift candidate matches an ignore rule; left it out of the queue',
    );
  }

  headAlreadyReviewed(reviewUrl: string): void {
    this.log.info(
      { fn: 'HeadDriftProbe.headAlreadyReviewed', repo: this.candidate!.repoFullName, pr: this.candidate!.prNumber, reviewUrl },
      'A completed review covers the head; recorded the review and enqueued nothing',
    );
  }

  headDriftFound(): void {
    this.log.info(
      {
        fn: 'HeadDriftProbe.headDriftFound',
        repo: this.candidate!.repoFullName,
        pr: this.candidate!.prNumber,
        headSha: this.candidate!.headSha,
        reviewedHeadSha: this.candidate!.reviewedHeadSha,
      },
      'No completed review covers the head; enqueuing a pending item',
    );
  }

  async recovered(tx: Prisma.TransactionClient): Promise<void> {
    await this.events.record(
      {
        type: EventType.head_drift_recovered,
        repo_full_name: this.candidate!.repoFullName,
        pr_number: this.candidate!.prNumber,
        ...getEventTraceAttributes(),
        payload: {
          head_sha: this.candidate!.headSha,
          reviewed_head_sha: this.candidate!.reviewedHeadSha ?? undefined,
        },
      },
      tx,
    );
    this.log.info(
      {
        fn: 'HeadDriftProbe.recovered',
        repo: this.candidate!.repoFullName,
        pr: this.candidate!.prNumber,
        headSha: this.candidate!.headSha,
        reviewedHeadSha: this.candidate!.reviewedHeadSha,
      },
      'Enqueued a pending item for a head that no review covers',
    );
  }
}
