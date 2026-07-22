import { EventType } from '../domain.js';

import type {
  BypassedPayload,
  CoderabbitReviewApprovedPayload,
  CoderabbitReviewChangesSuggestedPayload,
  CoderabbitReviewSkippedPayload,
  DetectedPayload,
  EnqueuedPayload,
  EventMetadata,
  FailedPayload,
  RetriggeredPayload,
} from './index.js';

/** Always-present columns shared by every event, regardless of type. */
export interface EventEnvelope {
  readonly id: number;
  readonly uuid: string;
  readonly ts: Date; // when we recorded the event
  readonly repo_full_name: string;
  readonly pr_number: number;
  readonly correlation_id: string;
  readonly request_id?: string;
  readonly version: string;
  readonly metadata?: EventMetadata;
}

// Keep union members in alphabetical order by EventType.
export type EventLogEntry =
  | (EventEnvelope & {
      readonly type: EventType.bypassed;
      readonly payload: BypassedPayload;
    })
  | (EventEnvelope & {
      readonly type: EventType.detected;
      readonly payload: DetectedPayload;
    })
  | (EventEnvelope & {
      readonly type: EventType.enqueued;
      readonly payload: EnqueuedPayload;
    })
  | (EventEnvelope & {
      readonly type: EventType.failed;
      readonly payload: FailedPayload;
    })
  | (EventEnvelope & {
      readonly type: EventType.retriggered;
      readonly payload: RetriggeredPayload;
    })
  | (EventEnvelope & {
      readonly type: EventType.coderabbit_review_approved;
      readonly payload: CoderabbitReviewApprovedPayload;
    })
  | (EventEnvelope & {
      readonly type: EventType.coderabbit_review_changes_suggested;
      readonly payload: CoderabbitReviewChangesSuggestedPayload;
    })
  | (EventEnvelope & {
      readonly type: EventType.coderabbit_review_skipped;
      readonly payload: CoderabbitReviewSkippedPayload;
    });
