import type { EventEnvelope, EventLogEntry } from '../types/EventLogEntry.js';
import { EventType } from '../types/EventType.js';

import { COMMENT_URL_MAX_LENGTH, REASON_MAX_LENGTH } from './lengths.js';

import type { Event as PrismaEvent } from '@prisma/client';
import { z } from 'zod';

export const DetectedPayloadSchema = z.object({
  source_ts: z.coerce.date().optional(),
  source_comment_url: z.string().max(COMMENT_URL_MAX_LENGTH).optional(),
});

export const EnqueuedPayloadSchema = z.object({
  scheduled_for: z.coerce.date(),
  new_wait: z.number().int().positive(),
});

export const PostedPayloadSchema = z.object({
  source_comment_url: z.string().max(COMMENT_URL_MAX_LENGTH),
  posted_comment_url: z.string().max(COMMENT_URL_MAX_LENGTH),
});

export const RejectedPayloadSchema = z.object({
  reason: z.string().max(REASON_MAX_LENGTH),
});

export const CompletedPayloadSchema = z.object({
  posted_comment_url: z.string().max(COMMENT_URL_MAX_LENGTH),
});

export const FailedPayloadSchema = z.object({
  reason: z.string().max(REASON_MAX_LENGTH),
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

  const payload: unknown = JSON.parse(row.payload);

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
    case EventType.posted:
      return {
        ...envelope,
        type: EventType.posted,
        payload: PostedPayloadSchema.parse(payload),
      };
    case EventType.rejected:
      return {
        ...envelope,
        type: EventType.rejected,
        payload: RejectedPayloadSchema.parse(payload),
      };
    case EventType.completed:
      return {
        ...envelope,
        type: EventType.completed,
        payload: CompletedPayloadSchema.parse(payload),
      };
    case EventType.failed:
      return {
        ...envelope,
        type: EventType.failed,
        payload: FailedPayloadSchema.parse(payload),
      };
    default:
      throw new Error(`Unknown event type: ${row.type}`);
  }
};
