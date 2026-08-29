/** A review-limit comment candidate for computing the next_review_available_at system state. */
export interface ReviewLimitCandidate {
  readonly updatedAt: Date;
  readonly waitSeconds: number | undefined;
}
