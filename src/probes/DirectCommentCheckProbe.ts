import type { EventRepository } from '../db/index.js';
import { EventType } from '../domain.js';
import type { ObservationContext } from '../observability/index.js';

import type { Logger } from '@couimet/logger-contract';

export class DirectCommentCheckProbe {
  private comment: { readonly repoFullName: string; readonly prNumber: number; readonly commentId: number } | undefined;

  constructor(
    private readonly events: EventRepository,
    private readonly observation: ObservationContext,
    private readonly log: Logger,
  ) {}

  withComment(repoFullName: string, prNumber: number, commentId: number): void {
    this.comment = { repoFullName, prNumber, commentId };
  }

  // Safety net: comment-scoped methods throw on an unbound context instead of
  // silently reporting the previous comment's identity.
  clearComment(): void {
    this.comment = undefined;
  }

  truncated(prCount: number, maxDirectCheckPRs: number): void {
    this.log.warn(
      { fn: 'DirectCommentCheckProbe.truncated', prCount, maxDirectCheckPRs },
      'PR count exceeds direct-check limit; truncating to prevent API rate-limit exhaustion',
    );
  }

  skippedUnclassified(): void {
    const { repoFullName, prNumber, commentId } = this.comment!;
    this.log.debug(
      { fn: 'DirectCommentCheckProbe.skippedUnclassified', repo: repoFullName, pr: prNumber, commentId },
      'Skipping comment with unknown classification',
    );
  }

  skippedOwnRetrigger(): void {
    const { repoFullName, prNumber, commentId } = this.comment!;
    this.log.debug({ fn: 'DirectCommentCheckProbe.skippedOwnRetrigger', repo: repoFullName, pr: prNumber, commentId }, 'Skipping own retrigger comment');
  }

  walkthroughRecorded(reviewedAt: Date): void {
    const { repoFullName, prNumber, commentId } = this.comment!;
    this.log.info(
      { fn: 'DirectCommentCheckProbe.walkthroughRecorded', repo: repoFullName, pr: prNumber, commentId, reviewedAt: reviewedAt.toISOString() },
      'Recorded walkthrough review activity',
    );
  }

  skippedAlreadySeen(): void {
    const { repoFullName, prNumber, commentId } = this.comment!;
    this.log.debug(
      { fn: 'DirectCommentCheckProbe.skippedAlreadySeen', repo: repoFullName, pr: prNumber, commentId },
      'Skipping comment already processed and not edited since',
    );
  }

  prCheckFailed(repoFullName: string, prNumber: number, error: unknown): void {
    this.log.warn({ fn: 'DirectCommentCheckProbe.prCheckFailed', repoFullName, prNumber, error }, 'Failed to direct-check PR comments; continuing');
  }

  found(found: number, checked: number): void {
    this.log.info({ fn: 'DirectCommentCheckProbe.found', found, checked }, 'Direct comment check found comments');
  }

  async runIdFirstSeen(commentUrl: string, coderabbitRunId: string): Promise<void> {
    const { repoFullName, prNumber, commentId } = this.comment!;
    const event = await this.events.record(
      {
        type: EventType.coderabbit_run_id_first_seen,
        repo_full_name: repoFullName,
        pr_number: prNumber,
        correlation_id: this.observation.correlationId,
        request_id: this.observation.requestId,
        version: this.observation.version,
        payload: { comment_id: commentId, comment_url: commentUrl, coderabbit_run_id: coderabbitRunId },
      },
      // Run ID events observe a comment; with no state-change partner
      undefined,
    );
    this.log.info(
      { fn: 'DirectCommentCheckProbe.runIdFirstSeen', repo: repoFullName, pr: prNumber, commentId, eventUuid: event.uuid, coderabbitRunId },
      'CodeRabbit run id observed for the first time',
    );
  }

  async runIdChanged(commentUrl: string, previousCoderabbitRunId: string, coderabbitRunId: string): Promise<void> {
    const { repoFullName, prNumber, commentId } = this.comment!;
    const event = await this.events.record(
      {
        type: EventType.coderabbit_run_id_changed,
        repo_full_name: repoFullName,
        pr_number: prNumber,
        correlation_id: this.observation.correlationId,
        request_id: this.observation.requestId,
        version: this.observation.version,
        payload: {
          comment_id: commentId,
          comment_url: commentUrl,
          previous_coderabbit_run_id: previousCoderabbitRunId,
          coderabbit_run_id: coderabbitRunId,
        },
      },
      // Run ID events observe a comment; with no state-change partner
      undefined,
    );
    this.log.info(
      {
        fn: 'DirectCommentCheckProbe.runIdChanged',
        repo: repoFullName,
        pr: prNumber,
        commentId,
        eventUuid: event.uuid,
        previousCoderabbitRunId,
        coderabbitRunId,
      },
      'CodeRabbit run id changed',
    );
  }

  async runIdCleared(commentUrl: string, previousCoderabbitRunId: string): Promise<void> {
    const { repoFullName, prNumber, commentId } = this.comment!;
    const event = await this.events.record(
      {
        type: EventType.coderabbit_run_id_cleared,
        repo_full_name: repoFullName,
        pr_number: prNumber,
        correlation_id: this.observation.correlationId,
        request_id: this.observation.requestId,
        version: this.observation.version,
        payload: {
          comment_id: commentId,
          comment_url: commentUrl,
          previous_coderabbit_run_id: previousCoderabbitRunId,
        },
      },
      // Run ID events observe a comment; with no state-change partner
      undefined,
    );
    this.log.info(
      { fn: 'DirectCommentCheckProbe.runIdCleared', repo: repoFullName, pr: prNumber, commentId, eventUuid: event.uuid, previousCoderabbitRunId },
      'CodeRabbit run id cleared',
    );
  }
}
