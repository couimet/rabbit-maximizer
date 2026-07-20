import type { PullRequestRepository } from '../../src/db/pullRequestRepository.js';

import { jest } from '@jest/globals';

export const createMockPullRequestRepo = (overrides?: Partial<jest.Mocked<PullRequestRepository>>): jest.Mocked<PullRequestRepository> =>
  ({
    upsert: jest.fn<any>().mockResolvedValue({ id: 1, created: true }),
    findByRepoAndPr: jest.fn<any>().mockResolvedValue(null),
    findByPrState: jest.fn<any>().mockResolvedValue([]),
    updateTitle: jest.fn<any>(),
    incrementRetriggerCount: jest.fn<any>(),
    recordReview: jest.fn<any>(),
    recordReviewLimitDetection: jest.fn<any>(),
    findPendingAcknowledgement: jest.fn<any>().mockResolvedValue(undefined),
    recordAcknowledgement: jest.fn<any>().mockResolvedValue(undefined),
    ...overrides,
  }) as unknown as jest.Mocked<PullRequestRepository>;
