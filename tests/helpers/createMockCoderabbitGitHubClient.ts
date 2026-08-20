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
    getPRHeadSha: jest.fn<any>().mockResolvedValue('default-head-sha'),
    getCommitCommittedAt: jest.fn<any>().mockResolvedValue('2026-08-20T00:00:00.000Z'),
    findCompletedReview: jest.fn<any>(),
    findLatestReviewLimitComment: jest.fn<any>(),
    findAcknowledgement: jest.fn<any>(),
    ...overrides,
  }) as unknown as jest.Mocked<CoderabbitGitHubClient>;
