import type { QueueStatus, Resolution, SkipReason, TriggerSource } from '../domain.js';

export interface QueueItem {
  readonly id: number;
  readonly uuid: string;
  readonly repo_full_name: string;
  readonly pr_number: number;
  readonly pr_title: string;
  readonly status: QueueStatus;
  readonly attempts: number;
  readonly source_comment_url: string;
  readonly source_comment_id: number;
  readonly source_comment_run_id?: string;
  readonly original_source_comment_url?: string;
  readonly trigger_source: TriggerSource;
  readonly retrigger_comment_url?: string;
  readonly retriggered_at?: Date;
  readonly cooldown_until?: Date;
  readonly last_skipped_at?: Date;
  readonly last_skip_reason?: SkipReason;
  readonly retrigger_skip_count: number;
  readonly failed_at?: Date;
  readonly reviewed_at?: Date;
  readonly resolved_at?: Date;
  readonly resolution?: Resolution;
  readonly pull_request_id: number;
  readonly created_at: Date;
  readonly updated_at: Date;
}
