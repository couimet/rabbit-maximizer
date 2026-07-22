import type { QueueStatus, TriggerSource } from '../domain.js';

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
  readonly trigger_source: TriggerSource;
  readonly retrigger_comment_url?: string;
  readonly retriggered_at?: Date;
  readonly failed_at?: Date;
  readonly reviewed_at?: Date;
  readonly pull_request_id: number;
  readonly pr_state?: string;
  readonly last_coderabbit_acknowledged_at?: Date;
  readonly created_at: Date;
  readonly updated_at: Date;
}
