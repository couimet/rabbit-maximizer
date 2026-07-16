/** Event lifecycle stage. Sorted by lifecycle: detection first, then processing, then review outcomes last. */
export enum EventType {
  detected = 'detected',
  enqueued = 'enqueued',
  retriggered = 'retriggered',
  bypassed = 'bypassed',
  failed = 'failed',
  coderabbit_review_approved = 'coderabbit_review_approved',
  coderabbit_review_changes_requested = 'coderabbit_review_changes_requested',
  coderabbit_review_skipped = 'coderabbit_review_skipped',
}
