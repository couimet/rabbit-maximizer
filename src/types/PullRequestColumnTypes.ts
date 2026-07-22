import type { PrState } from '../domain.js';

/** Maps `pull_request` column names to their TypeScript types. Used by {@link PullRequestRepository.getColumnMaps} to enforce type-safe column selection. */
export interface PullRequestColumnTypes {
  id: number;
  repo_full_name: string;
  pr_number: number;
  title: string;
  author_login: string;
  pr_state: PrState;
  last_coderabbit_acknowledged_at: Date | null;
  last_review_requested_at: Date | null;
  last_review_limit_at: Date | null;
  first_review_limit_at: Date | null;
  last_coderabbit_review_at: Date | null;
  first_seen_at: Date;
  retrigger_count: number;
  review_count: number;
}
