import type { CoderabbitGitHubClient } from '../../src/github/index.js';

import { jest } from '@jest/globals';

export const createMockCoderabbitGitHubClient = (overrides?: Partial<jest.Mocked<CoderabbitGitHubClient>>): jest.Mocked<CoderabbitGitHubClient> =>
  ({
    searchReviewLimitComments: jest.fn<any>(),
    fetchComment: jest.fn<any>(),
    listComments: jest.fn<any>(),
    listOpenPRs: jest.fn<any>().mockResolvedValue([]),
    postRetrigger: jest.fn<any>(),
    getPRState: jest.fn<any>(),
    findCompletedReview: jest.fn<any>(),
    findLatestCoderabbitReview: jest.fn<any>(),
    findLatestReviewLimitComment: jest.fn<any>(),
    findAcknowledgement: jest.fn<any>(),
    ...overrides,
  }) as unknown as jest.Mocked<CoderabbitGitHubClient>;
