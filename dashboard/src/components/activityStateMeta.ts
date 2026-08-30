import { ActivityState } from '../../../src/domain.js';

export const STATE_LABEL: Record<ActivityState, string> = {
  [ActivityState.reviewCompleted]: 'CodeRabbit: completed analysis',
  [ActivityState.manualReview]: 'Manual review',
  [ActivityState.failed]: 'Failed',
  [ActivityState.prMerged]: 'PR merged',
  [ActivityState.prClosed]: 'Closed',
  [ActivityState.skipped]: 'Skipped',
  [ActivityState.reviewInProgress]: 'CodeRabbit: review in progress',
  [ActivityState.reviewLimited]: 'CodeRabbit review-limited',
  [ActivityState.awaitingReview]: 'Awaiting CodeRabbit review',
  [ActivityState.staleComment]: 'Stale comment',
  [ActivityState.pending]: 'Pending',
  [ActivityState.unknown]: 'Unknown',
};

type StatusPillClass = 'reviewed' | 'failed' | 'merged' | 'closed' | 'skipped' | 'retriggered' | 'pending' | 'stale' | 'unknown';

export const STATE_CLASS: Record<ActivityState, StatusPillClass> = {
  [ActivityState.reviewCompleted]: 'reviewed',
  [ActivityState.manualReview]: 'reviewed',
  [ActivityState.failed]: 'failed',
  [ActivityState.prMerged]: 'merged',
  [ActivityState.prClosed]: 'closed',
  [ActivityState.skipped]: 'skipped',
  [ActivityState.reviewInProgress]: 'retriggered',
  [ActivityState.reviewLimited]: 'retriggered',
  [ActivityState.awaitingReview]: 'retriggered',
  [ActivityState.staleComment]: 'stale',
  [ActivityState.pending]: 'pending',
  [ActivityState.unknown]: 'unknown',
};
