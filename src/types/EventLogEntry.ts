import type { EventType } from "./EventType.js";

export interface EventLogEntry {
  readonly id: number;
  readonly uuid: string;
  readonly ts: string; // ISO 8601 UTC — when we recorded the event
  readonly source_ts?: string; // ISO 8601 UTC — from the incoming event payload (when available)
  readonly type: EventType;
  readonly repo_full_name: string;
  readonly pr_number: number;
  readonly source_comment_url?: string;
  readonly posted_comment_url?: string;
  readonly attempt_no?: number;
  readonly scheduled_for?: string;
  readonly outcome?: string;
  readonly new_wait?: string;
  readonly detail?: string;
}
