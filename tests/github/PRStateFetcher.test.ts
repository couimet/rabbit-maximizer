import { type CoderabbitGitHubClient, PRStateFetcher } from '../../src/github/index.js';
import type { PRState } from '../../src/types/index.js';
import { createMockCoderabbitGitHubClient, generateReviewRef } from '../helpers/index.js';

import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('PRStateFetcher', () => {
  let github: jest.Mocked<CoderabbitGitHubClient>;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    github = createMockCoderabbitGitHubClient();

    logger = createMockLogger();
  });

  const createFetcher = () => new PRStateFetcher(github, logger);

  describe('fetch', () => {
    it('returns PR state on success', async () => {
      const ref = generateReviewRef();
      const prState: PRState = { state: 'open', merged_at: null, closed_at: null };
      github.getPRState.mockResolvedValue(prState);

      const fetcher = createFetcher();
      const result = await fetcher.fetch(ref.repoFullName, ref.prNumber, 'testFn');

      expect(result).toBe(prState);
    });

    it('returns undefined and logs warning on failure', async () => {
      const ref = generateReviewRef();
      const apiError = new Error('API rate limit');
      github.getPRState.mockRejectedValue(apiError);

      const fetcher = createFetcher();
      const result = await fetcher.fetch(ref.repoFullName, ref.prNumber, 'testFn');

      expect(result).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        { fn: 'testFn::PRStateFetcher.fetch', repo: ref.repoFullName, pr: ref.prNumber, error: apiError },
        'Failed to fetch PR state',
      );
    });
    it('rethrows a rate-limit error so the owning caller can close the shared window', async () => {
      const ref = generateReviewRef();
      const rateLimitError = { status: 403, response: { headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1700000900' } } };
      github.getPRState.mockRejectedValue(rateLimitError);

      const fetcher = createFetcher();

      await expect(fetcher.fetch(ref.repoFullName, ref.prNumber, 'testFn')).rejects.toStrictEqual(rateLimitError);
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
