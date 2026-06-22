import type { CompletedPayload, DetectedPayload, EnqueuedPayload, EventMetadata, FailedPayload, PostedPayload, RejectedPayload } from './EventPayloads.js';
import { EventType } from './EventType.js';

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

export type EventLogEntry =
  | (EventEnvelope & {
      readonly type: EventType.detected;
      readonly payload: DetectedPayload;
    })
  | (EventEnvelope & {
      readonly type: EventType.enqueued;
      readonly payload: EnqueuedPayload;
    })
  | (EventEnvelope & {
      readonly type: EventType.posted;
      readonly payload: PostedPayload;
    })
  | (EventEnvelope & {
      readonly type: EventType.rejected;
      readonly payload: RejectedPayload;
    })
  | (EventEnvelope & {
      readonly type: EventType.completed;
      readonly payload: CompletedPayload;
    })
  | (EventEnvelope & {
      readonly type: EventType.failed;
      readonly payload: FailedPayload;
    });
