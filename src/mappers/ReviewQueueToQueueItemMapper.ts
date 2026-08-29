import type { QueueStatus, Resolution, SkipReason, TriggerSource } from '../domain.js';
import type { QueueItem } from '../types/index.js';
import { nullToUndefined, sqlDateToDate } from '../utils/index.js';

import type { ReviewQueue } from '@prisma/client';
import { injectable } from 'inversify';

@injectable()
export class ReviewQueueToQueueItemMapper {
  /* c8 ignore start — decorator emit branches */
  constructor() {}
  /* c8 ignore stop */

  fromReviewQueue(row: ReviewQueue): QueueItem {
    return {
      id: row.id,
      uuid: row.uuid,
      repo_full_name: row.repo_full_name,
      pr_number: row.pr_number,
      pr_title: row.pr_title,
      status: row.status as QueueStatus,
      attempts: row.attempts,
      source_comment_url: row.source_comment_url,
      source_comment_id: row.source_comment_id,
      source_comment_run_id: nullToUndefined(row.source_comment_run_id),
      original_source_comment_url: nullToUndefined(row.original_source_comment_url),
      trigger_source: row.trigger_source as TriggerSource,
      retrigger_comment_url: nullToUndefined(row.retrigger_comment_url),
      retriggered_at: sqlDateToDate(row.retriggered_at),
      cooldown_until: sqlDateToDate(row.cooldown_until),
      last_skipped_at: sqlDateToDate(row.last_skipped_at),
      last_skip_reason: nullToUndefined(row.last_skip_reason as SkipReason),
      retrigger_skip_count: row.retrigger_skip_count,
      failed_at: sqlDateToDate(row.failed_at),
      reviewed_at: sqlDateToDate(row.reviewed_at),
      resolved_at: sqlDateToDate(row.resolved_at),
      resolution: nullToUndefined(row.resolution as Resolution),
      // TODO[2026-08-29]: #79 - remove ! once pull_request_id backfill is complete
      pull_request_id: row.pull_request_id!,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
