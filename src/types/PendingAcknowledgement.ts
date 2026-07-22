/** A PullRequest that has a pending retrigger without a matching CodeRabbit acknowledgement. */
export interface PendingAcknowledgement {
  readonly id: number;
  readonly repo_full_name: string;
  readonly pr_number: number;
  readonly last_review_requested_at: Date;
}
