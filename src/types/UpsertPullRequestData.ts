import type { PrState } from '../domain.js';

export interface UpsertPullRequestData {
  readonly prTitle?: string;
  readonly prState: PrState;
  readonly authorLogin?: string;
  readonly mergedAt?: Date;
  readonly closedAt?: Date;
  readonly headSha?: string;
  readonly headCommittedAt?: Date;
}
