import type { PrState } from '../domain.js';

export interface UpsertPullRequestData {
  readonly prTitle?: string;
  readonly prState: PrState;
  readonly authorLogin?: string;
}
