import type { CodeRabbitCommentType } from '../CodeRabbitCommentType.js';
import type { FallbackReason } from '../FallbackReason.js';

import type { CoderabbitReviewVerdictState } from './CoderabbitReviewVerdict.js';

export type EditDetectionOutcome =
  | {
      readonly action: 'resolved';
      readonly reviewUrl: string;
      readonly verdictState: CoderabbitReviewVerdictState;
    }
  | { readonly action: 'skipped'; readonly reviewUrl: string }
  | { readonly action: 'adopted'; readonly runId: string }
  | {
      readonly action: 'fallback';
      readonly reason: FallbackReason;
      readonly sourceCommentType: CodeRabbitCommentType | undefined;
    };
