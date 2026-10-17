import type { CommentDetectionMethod } from '../CommentDetectionMethod.js';
import type { DismissalReason } from '../DismissalReason.js';
import type { IgnoreRuleField } from '../IgnoreRuleField.js';
import type { ReviewDetectionMethod } from '../ReviewDetectionMethod.js';

import type { CoderabbitReviewVerdictState } from './CoderabbitReviewVerdict.js';

/**
 * Type-specific payloads for each event type. These are persisted as the JSON
 * `payload` column on the events table; the envelope columns live on
 * {@link EventLogEntry}.
 */

export interface DetectedPayload {
  readonly source_ts?: Date; // from the incoming event payload, when available
  readonly source_comment_url?: string;
  readonly coderabbit_run_id?: string;
  readonly detected_via?: CommentDetectionMethod;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface EnqueuedPayload {}

export interface RetriggeredPayload {
  readonly source_comment_url: string;
  readonly retriggered_comment_url: string;
}

export interface CoderabbitReviewApprovedPayload {
  readonly coderabbit_comment_url?: string;
  readonly source_ts?: Date;
  readonly verdict_state?: CoderabbitReviewVerdictState;
  readonly detected_via?: ReviewDetectionMethod;
  readonly coderabbit_run_id?: string;
  /** The configured verdict phrase the body holds. Absent when the reviews API found the review. */
  readonly matched_phrase?: string;
  /** Zero-based index of the matched phrase in the body. Absent on rows that predate the offset. */
  readonly matched_offset?: number;
}

export interface CoderabbitReviewChangesSuggestedPayload {
  readonly coderabbit_comment_url?: string;
  readonly source_ts?: Date;
  readonly verdict_state?: CoderabbitReviewVerdictState;
  readonly detected_via?: ReviewDetectionMethod;
  readonly coderabbit_run_id?: string;
  /** The configured verdict phrase the body holds. Absent when the reviews API found the review. */
  readonly matched_phrase?: string;
  /** Zero-based index of the matched phrase in the body. Absent on rows that predate the offset. */
  readonly matched_offset?: number;
}

export interface CoderabbitReviewRefusedPayload {
  readonly source_ts: Date;
  readonly comment_url: string;
  readonly matched_phrase: string;
  /** Zero-based index of the matched phrase in the body. Absent on rows that predate the offset. */
  readonly matched_offset?: number;
  readonly coderabbit_run_id?: string;
}

export interface CoderabbitReviewSkippedPayload {
  readonly source_ts: Date;
  readonly comment_url: string;
  /** The configured phrase that decided the skip. Absent on rows that predate the configurable phrases. */
  readonly matched_phrase?: string;
  /** Zero-based index of the matched phrase in the body. Absent on rows that predate the offset. */
  readonly matched_offset?: number;
  /** Legacy free-text reason. Rows written before the phrases became configurable carry it. */
  readonly skip_reason?: string;
  readonly coderabbit_run_id?: string;
}

export interface CoderabbitRunIdChangedPayload {
  readonly comment_id: number;
  readonly comment_url: string;
  readonly previous_coderabbit_run_id: string;
  readonly coderabbit_run_id: string;
}

export interface CoderabbitRunIdClearedPayload {
  readonly comment_id: number;
  readonly comment_url: string;
  readonly previous_coderabbit_run_id: string;
}

export interface CoderabbitRunIdFirstSeenPayload {
  readonly comment_id: number;
  readonly comment_url: string;
  readonly coderabbit_run_id: string;
}

export interface ExcludedPayload {
  readonly source_ts: Date;
  readonly comment_url: string;
  readonly matched_field: IgnoreRuleField;
  readonly matched_pattern: string;
  readonly coderabbit_run_id?: string;
}

export interface FailedPayload {
  readonly reason: string;
  readonly retrigger_count?: number;
  readonly max?: number;
}

export interface HeadDriftRecoveredPayload {
  /** The head commit that no review covered when the sweep ran. */
  readonly head_sha: string;
  /** The head that the last recorded review covered. Absent when the row holds no reviewed head. */
  readonly reviewed_head_sha?: string;
}

export interface DismissedPayload {
  readonly reason: DismissalReason;
}

/** Rarely-queried provenance, persisted as the JSON `metadata` column. */
export interface EventMetadata {
  readonly git_sha?: string;
  readonly build_id?: string;
  readonly host?: string;
  readonly node_version?: string;
}
