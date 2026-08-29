export interface CompletedReview {
  readonly htmlUrl: string;
  readonly reviewId: number;
  readonly isApproval: boolean;
  /** Commit the review was submitted against (review.commit_id); drives head-sha matching when no run ID is known. */
  readonly commitId: string | undefined;
}
