/** A review-limit comment candidate for computing the next_review_available_at system state. */
export interface ReviewLimitCandidate {
  /** The updatedAt timestamp of the comment (from the GitHub API). */
  readonly updatedAt: Date;
  /** Parsed wait seconds from the comment body, or undefined if not parseable. */
  readonly waitSeconds: number | undefined;
}
