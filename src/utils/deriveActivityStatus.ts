import { ActivityState, CodeRabbitCommentType } from '../domain.js';
import { RabbitMaximizerError } from '../errors/index.js';
import type { ActivityStatus } from '../types/index.js';

import { isReviewVerdictState } from './isReviewVerdictState.js';

interface DeriveStatusInput {
  readonly status: string;
  readonly resolution?: string | null | undefined;
  readonly last_coderabbit_acknowledged_at?: string | null | undefined;
  readonly retrigger_comment_url?: string | null | undefined;
  readonly source_comment_url?: string;
  readonly coderabbit_review_state?: string | null;
  readonly coderabbit_review_url?: string | null;
  readonly last_review_state?: string | null;
  readonly last_review_url?: string | null;
}

export const deriveActivityStatus = (item: DeriveStatusInput): ActivityStatus => {
  switch (item.status) {
    case 'resolved':
      return resolvedStatus(item);
    case 'retriggered':
      return retriggeredStatus(item);
    case 'pending':
      return pendingStatus(item);
    default:
      throw RabbitMaximizerError.forUnexpectedSwitchDefault('queue item status', item.status, 'deriveActivityStatus');
  }
};

const resolvedStatus = (item: DeriveStatusInput): ActivityStatus => {
  // Legacy items may have a null resolution; guard before the switch.
  if (item.resolution == null) {
    return { state: ActivityState.reviewCompleted, linkUrl: undefined };
  }
  switch (item.resolution) {
    case 'review_completed':
      return reviewedStatus(item);
    case 'failed':
      return { state: ActivityState.failed, linkUrl: undefined };
    case 'pr_merged':
      return { state: ActivityState.prMerged, linkUrl: undefined };
    case 'pr_closed_without_merge':
      return { state: ActivityState.prClosed, linkUrl: undefined };
    case 'skipped':
      return { state: ActivityState.skipped, linkUrl: item.source_comment_url };
    case 'manual_review':
      return { state: ActivityState.manualReview, linkUrl: undefined };
    default:
      throw RabbitMaximizerError.forUnexpectedSwitchDefault('resolution', item.resolution, 'resolvedStatus');
  }
};

const reviewedStatus = (item: DeriveStatusInput): ActivityStatus => {
  let subState: ActivityStatus['subState'] = undefined;
  const reviewState: CodeRabbitCommentType | null | undefined =
    (item.coderabbit_review_state as CodeRabbitCommentType | null | undefined) ?? (item.last_review_state as CodeRabbitCommentType | null | undefined);
  if (isReviewVerdictState(reviewState)) {
    subState = reviewState;
  }
  const reviewUrl = item.coderabbit_review_url ?? item.last_review_url ?? undefined;
  return {
    state: ActivityState.reviewCompleted,
    linkUrl: reviewUrl,
    ...(subState ? { subState } : {}),
  };
};

const retriggeredStatus = (item: DeriveStatusInput): ActivityStatus => {
  if (item.source_comment_url) {
    return {
      state: ActivityState.reviewLimited,
      linkUrl: item.source_comment_url,
    };
  }
  if (item.last_coderabbit_acknowledged_at) {
    return {
      state: ActivityState.reviewInProgress,
      linkUrl: item.retrigger_comment_url ?? undefined,
    };
  }
  return {
    state: ActivityState.awaitingReview,
    linkUrl: item.retrigger_comment_url ?? undefined,
  };
};

const pendingStatus = (item: DeriveStatusInput): ActivityStatus => {
  if (item.source_comment_url) {
    return {
      state: ActivityState.reviewLimited,
      linkUrl: item.source_comment_url,
    };
  }
  return { state: ActivityState.pending, linkUrl: undefined };
};
