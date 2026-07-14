import type { PullRequestRepository } from '../../src/db/pullRequestRepository.js';

import { jest } from '@jest/globals';

export const createMockPullRequestRepo = (overrides?: Partial<jest.Mocked<PullRequestRepository>>): jest.Mocked<PullRequestRepository> =>
  ({
    upsert: jest.fn<any>().mockResolvedValue({ id: 1, created: true }),
    findByRepoAndPr: jest.fn<any>().mockResolvedValue(null),
    updateTitle: jest.fn<any>(),
    incrementRetriggerCount: jest.fn<any>(),
    recordReview: jest.fn<any>(),
    ...overrides,
  }) as unknown as jest.Mocked<PullRequestRepository>;
