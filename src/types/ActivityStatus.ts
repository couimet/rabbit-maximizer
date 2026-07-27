import type { ActivityState } from './ActivityState.js';
import type { CoderabbitReviewVerdictState } from './CoderabbitReviewVerdict.js';

export interface ActivityStatus {
  readonly state: ActivityState;
  readonly linkUrl: string | undefined;
  readonly subState?: CoderabbitReviewVerdictState;
}
