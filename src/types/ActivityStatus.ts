import type { ActivityState } from '../domain.js';

import type { CoderabbitReviewVerdictState } from './CoderabbitReviewVerdict.js';

export interface ActivityStatus {
  readonly state: ActivityState;
  readonly linkUrl: string | undefined;
  readonly subState?: CoderabbitReviewVerdictState;
}
