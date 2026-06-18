export interface RateLimitComment {
  readonly url: string;
  readonly repo_full_name: string;
  readonly pr_number: number;
  readonly comment_id: number;
  readonly created_at: string;
}
