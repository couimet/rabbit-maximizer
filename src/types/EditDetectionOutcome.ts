import type { FallbackReason } from '../FallbackReason.js';

import type { CoderabbitReviewVerdictState } from './CoderabbitReviewVerdict.js';

export type EditDetectionOutcome =
  | {
      readonly action: 'resolved';
      readonly reviewUrl: string;
      readonly verdictState: CoderabbitReviewVerdictState;
    }
  | { readonly action: 'fallback'; readonly reason: FallbackReason };
