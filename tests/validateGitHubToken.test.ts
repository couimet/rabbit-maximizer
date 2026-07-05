import { splitRepo } from '../src/github/splitRepo.js';
import type { RepoFilter } from '../src/types/RepoFilter.js';
import { validateGitHubToken } from '../src/validateGitHubToken.js';

import { createMockLogger, makeUniqueRepoName } from './helpers/index.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Octokit } from '@octokit/rest';

const FUNCTION_NAME = 'validateGitHubToken';

interface MockOctokitRest {
  users: { getAuthenticated: jest.Mock<any> };
  repos: { listForUser: jest.Mock<any> };
}

const createMockOctokit = (): { octokit: Octokit; rest: MockOctokitRest } => {
  const rest: MockOctokitRest = {
    users: { getAuthenticated: jest.fn<any>() },
    repos: { listForUser: jest.fn<any>() },
  };
  return { octokit: { rest } as unknown as Octokit, rest };
};

describe('validateGitHubToken', () => {
  let octokit: Octokit;
  let rest: MockOctokitRest;
  let logger: Logger;
  let userLogin: string;

  beforeEach(() => {
    ({ octokit, rest } = createMockOctokit());
    logger = createMockLogger();
    userLogin = getUniqueString({ prefix: 'user-' });
  });

  const mockAuth = () => rest.users.getAuthenticated.mockResolvedValue({ data: { login: userLogin } });

  describe('repo resolution', () => {
    it('resolves concrete repos and logs the count', async () => {
      mockAuth();
      const { fullName: repo1 } = makeUniqueRepoName();
      const { fullName: repo2 } = makeUniqueRepoName();
      const repoFilter: RepoFilter[] = [
        { pattern: repo1, scope: 'repo' },
        { pattern: repo2, scope: 'repo' },
      ];

      await validateGitHubToken({ octokit, repoFilter, log: logger });

      expect(logger.info as jest.Mock<any>).toHaveBeenCalledWith({ fn: FUNCTION_NAME, login: userLogin }, 'GitHub token authenticated');
      expect(logger.info as jest.Mock<any>).toHaveBeenCalledWith({ fn: FUNCTION_NAME, repoCount: 2 }, 'Resolved 2 repos from filter');
    });

    it('expands user-scope wildcards via listForUser', async () => {
      mockAuth();
      const { fullName: repo } = makeUniqueRepoName();
      const { owner } = splitRepo(repo);
      const repoFilter: RepoFilter[] = [{ pattern: `${owner}/*`, scope: 'user' }];

      rest.repos.listForUser.mockResolvedValue({ data: [{ full_name: repo }] });

      await validateGitHubToken({ octokit, repoFilter, log: logger });

      expect(rest.repos.listForUser).toHaveBeenCalledWith({
        username: owner,
        per_page: 100,
        page: 1,
        sort: 'updated',
        type: 'owner',
      });
      expect(logger.info as jest.Mock<any>).toHaveBeenCalledWith({ fn: FUNCTION_NAME, repoCount: 1 }, 'Resolved 1 repos from filter');
    });

    it('paginates listForUser when results span multiple pages', async () => {
      mockAuth();
      const repos = Array.from({ length: 150 }, () => makeUniqueRepoName().fullName);
      const repoFilter: RepoFilter[] = [{ pattern: 'owner/*', scope: 'user' }];

      rest.repos.listForUser
        .mockResolvedValueOnce({ data: repos.slice(0, 100).map((fn) => ({ full_name: fn })) })
        .mockResolvedValueOnce({ data: repos.slice(100).map((fn) => ({ full_name: fn })) });

      await validateGitHubToken({ octokit, repoFilter, log: logger });

      expect(rest.repos.listForUser).toHaveBeenCalledTimes(2);
      expect(logger.info as jest.Mock<any>).toHaveBeenCalledWith({ fn: FUNCTION_NAME, repoCount: 150 }, 'Resolved 150 repos from filter');
    });
  });

  describe('errors', () => {
    it('throws when the token fails to authenticate', async () => {
      rest.users.getAuthenticated.mockRejectedValue(new Error('Bad credentials'));

      await expect(validateGitHubToken({ octokit, repoFilter: [{ pattern: 'o/r', scope: 'repo' }], log: logger })).rejects.toThrow('Bad credentials');
    });

    it('throws when the filter resolves to zero repos', async () => {
      mockAuth();
      rest.repos.listForUser.mockResolvedValue({ data: [] });

      await expect(() => validateGitHubToken({ octokit, repoFilter: [{ pattern: 'owner/*', scope: 'user' }], log: logger })).toThrowDetailedErrorAsync(
        'TOKEN_VALIDATION_EMPTY_FILTER',
        {
          message: 'REPO_FILTER resolved to zero repositories. Check that the filter matches at least one accessible repo.',
          functionName: 'resolveAllRepos',
        },
      );
    });
  });
});
