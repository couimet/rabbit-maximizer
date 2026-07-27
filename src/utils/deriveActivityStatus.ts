import { RabbitMaximizerError } from '../errors/index.js';
import { ActivityState, type ActivityStatus, CodeRabbitCommentType, type QueueItemResponse } from '../types/index.js';

export const deriveActivityStatus = (item: QueueItemResponse): ActivityStatus => {
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

const resolvedStatus = (item: QueueItemResponse): ActivityStatus => {
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
    default:
      return { state: ActivityState.unknownResolution, linkUrl: undefined };
  }
};

const reviewedStatus = (item: QueueItemResponse): ActivityStatus => {
  let subState: ActivityStatus['subState'] = undefined;
  if (item.coderabbit_review_state === CodeRabbitCommentType.review_approved) {
    subState = CodeRabbitCommentType.review_approved;
  } else if (item.coderabbit_review_state === CodeRabbitCommentType.review_changes_suggested) {
    subState = CodeRabbitCommentType.review_changes_suggested;
  }
  return {
    state: ActivityState.reviewCompleted,
    linkUrl: item.coderabbit_review_url ?? undefined,
    ...(subState ? { subState } : {}),
  };
};

const retriggeredStatus = (item: QueueItemResponse): ActivityStatus => {
  if (item.last_coderabbit_acknowledged_at) {
    return {
      state: ActivityState.reviewInProgress,
      linkUrl: item.retrigger_comment_url ?? undefined,
    };
  }
  if (item.source_comment_url) {
    return {
      state: ActivityState.reviewLimited,
      linkUrl: item.source_comment_url,
    };
  }
  return {
    state: ActivityState.awaitingReview,
    linkUrl: item.retrigger_comment_url ?? undefined,
  };
};

const pendingStatus = (item: QueueItemResponse): ActivityStatus => {
  if (item.source_comment_url) {
    return {
      state: ActivityState.reviewLimited,
      linkUrl: item.source_comment_url,
    };
  }
  return { state: ActivityState.pending, linkUrl: undefined };
};
