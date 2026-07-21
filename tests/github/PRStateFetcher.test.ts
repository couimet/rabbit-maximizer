import type { CoderabbitGitHubClient } from '../../src/github/coderabbitGitHubClient.js';
import { PRStateFetcherImpl } from '../../src/github/PRStateFetcher.js';
import type { PRState } from '../../src/types/PRState.js';
import { createMockCoderabbitGitHubClient } from '../helpers/index.js';

import { getUniqueGitHubRepoRef, getUniqueInt } from '@couimet/dynamic-testing';
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
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const prState: PRState = { state: 'open', merged_at: null };
      github.getPRState.mockResolvedValue(prState);

      const fetcher = createFetcher();
      const result = await fetcher.fetch(repo, pr, 'testFn');

      expect(result).toBe(prState);
    });

    it('returns undefined and logs warning on failure', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const apiError = new Error('API rate limit');
      github.getPRState.mockRejectedValue(apiError);

      const fetcher = createFetcher();
      const result = await fetcher.fetch(repo, pr, 'testFn');

      expect(result).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith({ fn: 'testFn', repo, pr, error: apiError }, 'Failed to fetch PR state; proceeding without it');
    });
  });
});
