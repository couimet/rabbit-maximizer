import { type CoderabbitGitHubClient, PRStateFetcherImpl } from '../../src/github/index.js';
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

  const createFetcher = () => new PRStateFetcherImpl(github, logger);

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
  });
});
