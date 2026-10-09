import type { CoderabbitGitHubClient } from '../../src/github/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { jest } from '@jest/globals';

export const createMockCoderabbitGitHubClient = (overrides?: Partial<jest.Mocked<CoderabbitGitHubClient>>): jest.Mocked<CoderabbitGitHubClient> =>
  ({
    searchReviewLimitComments: jest.fn<any>(),
    fetchComment: jest.fn<any>(),
    listComments: jest.fn<any>(),
    listOpenPRs: jest.fn<any>().mockResolvedValue([]),
    postRetrigger: jest.fn<any>(),
    getQuota: jest.fn<any>().mockResolvedValue({
      resource: getUniqueString({ prefix: 'resource-' }),
      limit: getUniqueInt(),
      remaining: getUniqueInt(),
      used: getUniqueInt(),
      resetEpoch: getUniqueInt(),
    }),
    getPRState: jest.fn<any>(),
    getPRHeadSha: jest.fn<any>().mockResolvedValue(getUniqueString({ prefix: 'head-' })),
    getCommitCommittedAt: jest.fn<any>().mockResolvedValue(getUniqueDate().toISOString()),
    findCompletedReview: jest.fn<any>(),
    findLatestReviewLimitComment: jest.fn<any>(),
    findAcknowledgement: jest.fn<any>(),
    ...overrides,
  }) as unknown as jest.Mocked<CoderabbitGitHubClient>;
