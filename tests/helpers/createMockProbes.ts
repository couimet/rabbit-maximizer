import { jest } from '@jest/globals';

export interface MockPrunerProbe {
  withItem: jest.Mock<any>;
  noItemsToPrune: jest.Mock<any>;
  prMerged: jest.Mock<any>;
  prClosedWithoutMerge: jest.Mock<any>;
  caughtError: jest.Mock<any>;
}
export const createMockPrunerProbe = (): MockPrunerProbe => ({
  withItem: jest.fn<any>(),
  noItemsToPrune: jest.fn<any>(),
  prMerged: jest.fn<any>().mockResolvedValue(undefined),
  prClosedWithoutMerge: jest.fn<any>().mockResolvedValue(undefined),
  caughtError: jest.fn<any>(),
});

export interface MockDetectedProbe {
  detected: jest.Mock<() => Promise<void>>;
  enqueued: jest.Mock<() => Promise<unknown>>;
  prMerged: jest.Mock<() => Promise<unknown>>;
  prClosedWithoutMerge: jest.Mock<() => Promise<unknown>>;
  alreadyQueued: jest.Mock;
}
export const createMockDetectedProbe = (): MockDetectedProbe => ({
  detected: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  enqueued: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
  prMerged: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
  prClosedWithoutMerge: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
  alreadyQueued: jest.fn(),
});

export interface MockReviewDetectorProbe {
  withItem: jest.Mock<any>;
  noRetriggeredItemFound: jest.Mock<any>;
  noCompletedReviewFound: jest.Mock<any>;
  reviewed: jest.Mock<any>;
  caughtError: jest.Mock<any>;
}
export const createMockReviewDetectorProbe = (): MockReviewDetectorProbe => ({
  withItem: jest.fn<any>(),
  noRetriggeredItemFound: jest.fn<any>(),
  noCompletedReviewFound: jest.fn<any>(),
  reviewed: jest.fn<any>(),
  caughtError: jest.fn<any>(),
});

export interface MockEnqueueProbe {
  enqueued: jest.Mock<any>;
  recentlyRetriggered: jest.Mock<any>;
  alreadyQueued: jest.Mock<any>;
  alreadyQueuedRescheduled: jest.Mock<any>;
}
export const createMockEnqueueProbe = (): MockEnqueueProbe => ({
  enqueued: jest.fn<any>(),
  recentlyRetriggered: jest.fn<any>(),
  alreadyQueued: jest.fn<any>(),
  alreadyQueuedRescheduled: jest.fn<any>(),
});

export interface MockSchedulerProbe {
  pruningCompleted: jest.Mock<any>;
  schedulerPaused: jest.Mock<any>;
  tickSkippedAwaitingAcknowledgement: jest.Mock<any>;
  noItemsDue: jest.Mock<any>;
  tickFailed: jest.Mock<any>;
  rescheduled: jest.Mock<any>;
  skipped: jest.Mock<any>;
  withItem: jest.Mock<any>;
  retriggered: jest.Mock<any>;
  prClosedOrMerged: jest.Mock<any>;
  backedOff: jest.Mock<any>;
  triggerFailed: jest.Mock<any>;
}
export const createMockSchedulerProbe = (): MockSchedulerProbe => ({
  pruningCompleted: jest.fn<any>(),
  schedulerPaused: jest.fn<any>(),
  tickSkippedAwaitingAcknowledgement: jest.fn<any>(),
  noItemsDue: jest.fn<any>(),
  tickFailed: jest.fn<any>(),
  rescheduled: jest.fn<any>(),
  skipped: jest.fn<any>(),
  withItem: jest.fn<any>(),
  retriggered: jest.fn<any>(),
  prClosedOrMerged: jest.fn<any>(),
  backedOff: jest.fn<any>(),
  triggerFailed: jest.fn<any>(),
});

export interface MockReviewRetriggerProbe {
  staleCommentSkipped: jest.Mock<any>;
  staleCommentReplacementDeleted: jest.Mock<any>;
  staleCommentRescheduled: jest.Mock<any>;
  reviewRetriggered: jest.Mock<any>;
}
export const createMockReviewRetriggerProbe = (): MockReviewRetriggerProbe => ({
  staleCommentSkipped: jest.fn<any>(),
  staleCommentReplacementDeleted: jest.fn<any>(),
  staleCommentRescheduled: jest.fn<any>(),
  reviewRetriggered: jest.fn<any>(),
});

export interface MockMarkQueueItemReviewedProbe {
  queueItemNotFound: jest.Mock<any>;
  queueItemMarkedReviewed: jest.Mock<any>;
}
export const createMockMarkQueueItemReviewedProbe = (): MockMarkQueueItemReviewedProbe => ({
  queueItemNotFound: jest.fn<any>(),
  queueItemMarkedReviewed: jest.fn<any>(),
});
