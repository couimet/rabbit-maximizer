import type { QueueStatus, TriggerSource } from '../domain.js';
import type { QueueItem } from '../types/index.js';
import { sqlDateToDate } from '../utils/index.js';

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
      trigger_source: row.trigger_source as TriggerSource,
      retrigger_comment_url: row.retrigger_comment_url ?? undefined,
      retriggered_at: sqlDateToDate(row.retriggered_at),
      failed_at: sqlDateToDate(row.failed_at),
      reviewed_at: sqlDateToDate(row.reviewed_at),
      // TODO[2026-08-22]: #79 - remove ! once pull_request_id backfill is complete
      pull_request_id: row.pull_request_id!,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
