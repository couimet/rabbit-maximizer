/** An open PullRequest with a retrigger history but no active queue item (pending or retriggered). */
export interface StaleOpenPR {
  readonly id: number;
  readonly repoFullName: string;
  readonly prNumber: number;
  readonly title: string;
  readonly lastReviewRequestedAt: Date;
}
