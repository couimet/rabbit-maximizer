/**
 * Type-specific payloads for each event type. These are persisted as the JSON
 * `payload` column on the events table; the envelope columns live on
 * {@link EventLogEntry}.
 */

export interface DetectedPayload {
  readonly source_ts?: Date; // from the incoming event payload, when available
  readonly source_comment_url?: string;
}

export interface EnqueuedPayload {
  readonly not_before: Date;
  readonly new_wait: number;
}

export interface RetriggeredPayload {
  readonly source_comment_url: string;
  readonly retriggered_comment_url: string;
}

export interface CoderabbitReviewApprovedPayload {
  readonly coderabbit_comment_url?: string;
}

export interface CoderabbitReviewChangesRequestedPayload {
  readonly coderabbit_comment_url?: string;
}

export interface FailedPayload {
  readonly reason: string;
}

export enum BypassReason {
  prMerged = 'prMerged',
  prClosedWithoutMerge = 'prClosedWithoutMerge',
  other = 'other',
}

export interface BypassedPayload {
  readonly reason: BypassReason;
  readonly detail?: string;
}

/** Rarely-queried provenance, persisted as the JSON `metadata` column. */
export interface EventMetadata {
  readonly git_sha?: string;
  readonly build_id?: string;
  readonly host?: string;
  readonly node_version?: string;
}
