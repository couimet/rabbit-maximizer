import type { PullRequestRepository } from '../../src/db/index.js';

import { jest } from '@jest/globals';

type ColumnMapsStub = Record<string, Map<number, any>>;

/**
 * `jest.Mocked` collapses the type parameter of `getColumnMaps` onto its constraint, so
 * `mockResolvedValue` would demand a map for all 19 `PullRequestColumnTypes` columns.
 * This type replaces that one method with a signature a test can satisfy with the
 * columns it selects.
 */
export type MockedPullRequestRepo = jest.Mocked<PullRequestRepository> & {
  getColumnMaps: jest.Mock<(ids: number[], columns: readonly string[]) => Promise<ColumnMapsStub>>;
};

export const createMockPullRequestRepo = (overrides?: Partial<MockedPullRequestRepo>): MockedPullRequestRepo =>
  ({
    upsert: jest.fn<any>().mockResolvedValue({ id: 1, created: true }),
    findByRepoAndPr: jest.fn<any>().mockResolvedValue(null),
    findByPrState: jest.fn<any>().mockResolvedValue([]),
    updateTitle: jest.fn<any>(),
    incrementRetriggerCount: jest.fn<any>(),
    recordReview: jest.fn<any>(),
    recordReviewLimitDetection: jest.fn<any>(),
    setPermanentRefusalAt: jest.fn<any>().mockResolvedValue(undefined),
    recordWalkthroughReview: jest.fn<any>(),
    findPendingAcknowledgements: jest.fn<any>().mockResolvedValue([]),
    findStaleOpenPRs: jest.fn<any>().mockResolvedValue([]),
    findIgnoreRuleTarget: jest.fn<any>().mockResolvedValue(null),
    findTrackedPRs: jest.fn<any>().mockResolvedValue([]),
    recordAcknowledgement: jest.fn<any>().mockResolvedValue(undefined),
    getColumnMaps: jest
      .fn<(ids: number[], columns: readonly string[]) => Promise<ColumnMapsStub>>()
      .mockResolvedValue({ pr_state: new Map(), last_coderabbit_acknowledged_at: new Map(), retrigger_count: new Map() }),
    ...overrides,
  }) as unknown as MockedPullRequestRepo;
