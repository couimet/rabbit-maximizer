/** Event lifecycle stage. Alphabetically sorted. */
export enum EventType {
  coderabbit_review_approved = 'coderabbit_review_approved',
  coderabbit_review_changes_suggested = 'coderabbit_review_changes_suggested',
  coderabbit_review_skipped = 'coderabbit_review_skipped',
  coderabbit_run_id_changed = 'coderabbit_run_id_changed',
  coderabbit_run_id_cleared = 'coderabbit_run_id_cleared',
  coderabbit_run_id_first_seen = 'coderabbit_run_id_first_seen',
  detected = 'detected',
  dismissed = 'dismissed',
  enqueued = 'enqueued',
  failed = 'failed',
  retriggered = 'retriggered',
}
