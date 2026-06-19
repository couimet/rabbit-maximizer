import type { QueueStatus } from "./QueueStatus.js";

export interface QueueItem {
  readonly id: number;
  readonly uuid: string;
  readonly repo_full_name: string;
  readonly pr_number: number;
  readonly status: QueueStatus;
  readonly scheduled_for: Date;
  readonly attempts: number;
  readonly created_at: Date;
  readonly updated_at: Date;
}
