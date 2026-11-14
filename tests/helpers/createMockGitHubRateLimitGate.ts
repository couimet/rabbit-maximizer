import type { GitHubRateLimitGate } from '../../src/github/index.js';

import { jest } from '@jest/globals';

export const createMockGitHubRateLimitGate = (): jest.Mocked<GitHubRateLimitGate> =>
  ({
    isBlocked: jest.fn<any>().mockReturnValue(false),
    retryAfterMs: jest.fn<any>().mockReturnValue(undefined),
    recordError: jest.fn<any>().mockResolvedValue(false),
    initialize: jest.fn<any>().mockResolvedValue(undefined),
  }) as unknown as jest.Mocked<GitHubRateLimitGate>;
