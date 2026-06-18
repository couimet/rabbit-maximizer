import type { QueueStatus } from "./QueueStatus.js";

export interface QueueItem {
  readonly id: number;
  readonly uuid: string;
  readonly repo_full_name: string;
  readonly pr_number: number;
  readonly status: QueueStatus;
  readonly scheduled_for: string; // ISO 8601 UTC timestamp
  readonly attempts: number;
  readonly created_at: string;
  readonly updated_at: string;
}
