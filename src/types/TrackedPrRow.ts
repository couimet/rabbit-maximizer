/** An open PR that CodeRabbit has touched, has not been acknowledged, and has no active queue item. */
export interface TrackedPrRow {
  readonly id: number;
  readonly title: string;
  readonly repo_full_name: string;
  readonly pr_number: number;
  readonly author_login: string;
  readonly last_review_state: string | null;
  readonly last_coderabbit_review_at: Date | null;
}
