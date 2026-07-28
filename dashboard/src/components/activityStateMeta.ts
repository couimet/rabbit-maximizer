import { ActivityState } from '../../../src/domain.js';

export const STATE_LABEL: Record<ActivityState, string> = {
  [ActivityState.reviewCompleted]: 'Reviewed',
  [ActivityState.failed]: 'Failed',
  [ActivityState.prMerged]: 'Merged',
  [ActivityState.prClosed]: 'Closed',
  [ActivityState.skipped]: 'Skipped',
  [ActivityState.unknownResolution]: 'Resolved',
  [ActivityState.reviewInProgress]: 'In progress',
  [ActivityState.reviewLimited]: 'Review limited',
  [ActivityState.awaitingReview]: 'Awaiting review',
  [ActivityState.pending]: 'Pending',
};

export const STATE_CLASS: Record<ActivityState, string> = {
  [ActivityState.reviewCompleted]: 'reviewed',
  [ActivityState.failed]: 'failed',
  [ActivityState.prMerged]: 'merged',
  [ActivityState.prClosed]: 'closed',
  [ActivityState.skipped]: 'skipped',
  [ActivityState.unknownResolution]: 'reviewed',
  [ActivityState.reviewInProgress]: 'retriggered',
  [ActivityState.reviewLimited]: 'retriggered',
  [ActivityState.awaitingReview]: 'retriggered',
  [ActivityState.pending]: 'pending',
};
