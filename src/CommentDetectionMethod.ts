/** How a CodeRabbit review-limit comment first came to the poll's attention. Recorded on detected events so the row and its log can say which mechanism found the comment. */
export enum CommentDetectionMethod {
  /** Found by the GitHub comment search across the watched repos. */
  Search = 'search',
  /** Found by listing comments on each scanned open PR, bypassing search indexing lag. */
  DirectScan = 'direct_scan',
  /** Synthesized for an open PR whose real review-limit comment was deleted. */
  StaleRecovery = 'stale_recovery',
}
