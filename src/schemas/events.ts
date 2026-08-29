import { CodeRabbitCommentType, DismissalReason, EventType } from '../domain.js';
import { RabbitMaximizerError } from '../errors/index.js';
import { ReviewDetectionMethod } from '../ReviewDetectionMethod.js';
import type { EventEnvelope, EventLogEntry } from '../types/index.js';

import { CODERABBIT_RUN_ID_MAX_LENGTH, COMMENT_URL_MAX_LENGTH, REASON_MAX_LENGTH } from './lengths.js';

import type { Event as PrismaEvent } from '@prisma/client';
import { z } from 'zod';

const COMMENT_URL_SCHEMA = z.string().max(COMMENT_URL_MAX_LENGTH);

export const DetectedPayloadSchema = z.object({
  source_ts: z.coerce.date().optional(),
  source_comment_url: COMMENT_URL_SCHEMA.optional(),
  coderabbit_run_id: z.string().max(CODERABBIT_RUN_ID_MAX_LENGTH).optional(),
});

export const EnqueuedPayloadSchema = z.object({});

export const RetriggeredPayloadSchema = z.object({
  source_comment_url: COMMENT_URL_SCHEMA,
  retriggered_comment_url: COMMENT_URL_SCHEMA,
});

export const DismissedPayloadSchema = z.object({
  reason: z.enum(DismissalReason),
});

export const CoderabbitReviewApprovedPayloadSchema = z.object({
  coderabbit_comment_url: COMMENT_URL_SCHEMA.optional(),
  source_ts: z.coerce.date().optional(),
  verdict_state: z.enum([CodeRabbitCommentType.review_approved, CodeRabbitCommentType.review_changes_suggested]).optional(),
  detected_via: z.enum(ReviewDetectionMethod).optional(),
  coderabbit_run_id: z.string().max(CODERABBIT_RUN_ID_MAX_LENGTH).optional(),
});

export const CoderabbitReviewChangesSuggestedPayloadSchema = z.object({
  coderabbit_comment_url: COMMENT_URL_SCHEMA.optional(),
  source_ts: z.coerce.date().optional(),
  verdict_state: z.enum([CodeRabbitCommentType.review_approved, CodeRabbitCommentType.review_changes_suggested]).optional(),
  detected_via: z.enum(ReviewDetectionMethod).optional(),
  coderabbit_run_id: z.string().max(CODERABBIT_RUN_ID_MAX_LENGTH).optional(),
});

export const CoderabbitReviewSkippedPayloadSchema = z.object({
  source_ts: z.coerce.date(),
  comment_url: COMMENT_URL_SCHEMA,
  skip_reason: z.string(),
  coderabbit_run_id: z.string().max(CODERABBIT_RUN_ID_MAX_LENGTH).optional(),
});

export const CoderabbitRunIdChangedPayloadSchema = z.object({
  comment_id: z.number().int(),
  comment_url: COMMENT_URL_SCHEMA,
  previous_coderabbit_run_id: z.string().max(CODERABBIT_RUN_ID_MAX_LENGTH),
  coderabbit_run_id: z.string().max(CODERABBIT_RUN_ID_MAX_LENGTH),
});

export const CoderabbitRunIdClearedPayloadSchema = z.object({
  comment_id: z.number().int(),
  comment_url: COMMENT_URL_SCHEMA,
  previous_coderabbit_run_id: z.string().max(CODERABBIT_RUN_ID_MAX_LENGTH),
});

export const CoderabbitRunIdFirstSeenPayloadSchema = z.object({
  comment_id: z.number().int(),
  comment_url: COMMENT_URL_SCHEMA,
  coderabbit_run_id: z.string().max(CODERABBIT_RUN_ID_MAX_LENGTH),
});

export const FailedPayloadSchema = z.object({
  reason: z.string().max(REASON_MAX_LENGTH),
  retrigger_count: z.number().int().positive().optional(),
  max: z.number().int().positive().optional(),
});

export const EventMetadataSchema = z.object({
  git_sha: z.string().optional(),
  build_id: z.string().optional(),
  host: z.string().optional(),
  node_version: z.string().optional(),
});

/** Validate a stored events row into a typed, discriminated EventLogEntry. */
export const parseEventRow = (row: PrismaEvent): EventLogEntry => {
  const envelope: EventEnvelope = {
    id: row.id,
    uuid: row.uuid,
    ts: row.ts,
    repo_full_name: row.repo_full_name,
    pr_number: row.pr_number,
    correlation_id: row.correlation_id,
    request_id: row.request_id ?? undefined,
    version: row.version,
    metadata: row.metadata ? EventMetadataSchema.parse(JSON.parse(row.metadata)) : undefined,
  };

  const payload = JSON.parse(row.payload);

  switch (row.type) {
    case EventType.detected:
      return {
        ...envelope,
        type: EventType.detected,
        payload: DetectedPayloadSchema.parse(payload),
      };
    case EventType.enqueued:
      return {
        ...envelope,
        type: EventType.enqueued,
        payload: EnqueuedPayloadSchema.parse(payload),
      };
    case EventType.retriggered:
      return {
        ...envelope,
        type: EventType.retriggered,
        payload: RetriggeredPayloadSchema.parse(payload),
      };
    case EventType.dismissed:
      return {
        ...envelope,
        type: EventType.dismissed,
        payload: DismissedPayloadSchema.parse(payload),
      };
    case EventType.coderabbit_review_approved:
      return {
        ...envelope,
        type: EventType.coderabbit_review_approved,
        payload: CoderabbitReviewApprovedPayloadSchema.parse(payload),
      };
    case EventType.coderabbit_review_changes_suggested:
      return {
        ...envelope,
        type: EventType.coderabbit_review_changes_suggested,
        payload: CoderabbitReviewChangesSuggestedPayloadSchema.parse(payload),
      };
    case EventType.coderabbit_review_skipped:
      return {
        ...envelope,
        type: EventType.coderabbit_review_skipped,
        payload: CoderabbitReviewSkippedPayloadSchema.parse(payload),
      };
    case EventType.coderabbit_run_id_changed:
      return {
        ...envelope,
        type: EventType.coderabbit_run_id_changed,
        payload: CoderabbitRunIdChangedPayloadSchema.parse(payload),
      };
    case EventType.coderabbit_run_id_cleared:
      return {
        ...envelope,
        type: EventType.coderabbit_run_id_cleared,
        payload: CoderabbitRunIdClearedPayloadSchema.parse(payload),
      };
    case EventType.coderabbit_run_id_first_seen:
      return {
        ...envelope,
        type: EventType.coderabbit_run_id_first_seen,
        payload: CoderabbitRunIdFirstSeenPayloadSchema.parse(payload),
      };
    case EventType.failed:
      return {
        ...envelope,
        type: EventType.failed,
        payload: FailedPayloadSchema.parse(payload),
      };
    default:
      throw RabbitMaximizerError.forUnexpectedSwitchDefault('event type', row.type, 'parseEventRow');
  }
};
