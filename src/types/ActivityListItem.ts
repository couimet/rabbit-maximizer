import type { QueueItem } from './QueueItem.js';

/**
 * API contract for the Activity List dashboard view.
 *
 * Extends the DB-level {@link QueueItem} with fields joined from
 * {@link pull_request} so the dashboard receives a complete row.
 */
export interface ActivityListItem extends QueueItem {
  readonly last_coderabbit_acknowledged_at?: Date;
}
