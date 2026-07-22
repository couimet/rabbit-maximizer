import type { PrState } from '../PrState.js';

export interface UpsertPullRequestData {
  readonly prTitle?: string;
  readonly prState: PrState;
  readonly authorLogin?: string;
}
