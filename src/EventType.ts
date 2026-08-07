/** Event lifecycle stage. Alphabetically sorted. */
export enum EventType {
  coderabbit_review_approved = 'coderabbit_review_approved',
  coderabbit_review_changes_suggested = 'coderabbit_review_changes_suggested',
  coderabbit_review_skipped = 'coderabbit_review_skipped',
  detected = 'detected',
  dismissed = 'dismissed',
  enqueued = 'enqueued',
  failed = 'failed',
  retriggered = 'retriggered',
}
