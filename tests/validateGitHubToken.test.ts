import { splitRepo } from '../src/github/splitRepo.js';
import type { RepoFilter } from '../src/types/RepoFilter.js';
import { validateGitHubToken } from '../src/validateGitHubToken.js';

import { createMockLogger, makeUniqueRepoName } from './helpers/index.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Octokit } from '@octokit/rest';

const FUNCTION_NAME = 'validateGitHubToken';
const TOKEN_SETTINGS_URL = 'https://github.com/settings/personal-access-tokens';
const NONEXISTENT_ISSUE = 99_999_999;

interface MockOctokitRest {
  users: { getAuthenticated: jest.Mock<any> };
  repos: { get: jest.Mock<any>; listForUser: jest.Mock<any> };
  issues: { createComment: jest.Mock<any> };
}

const createMockOctokit = (): { octokit: Octokit; rest: MockOctokitRest } => {
  const rest: MockOctokitRest = {
    users: { getAuthenticated: jest.fn<any>() },
    repos: { get: jest.fn<any>(), listForUser: jest.fn<any>() },
    issues: { createComment: jest.fn<any>() },
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

  describe('all repos pass', () => {
    it('validates concrete repos in parallel and logs success', async () => {
      mockAuth();
      const { fullName: repo1 } = makeUniqueRepoName();
      const { fullName: repo2 } = makeUniqueRepoName();
      const repoFilter: RepoFilter[] = [
        { pattern: repo1, scope: 'repo' },
        { pattern: repo2, scope: 'repo' },
      ];
      rest.repos.get.mockResolvedValue({ data: {} });
      rest.issues.createComment.mockRejectedValue({ status: 404 });

      await validateGitHubToken({ octokit, repoFilter, log: logger });

      const { owner: o1, repo: r1 } = splitRepo(repo1);
      const { owner: o2, repo: r2 } = splitRepo(repo2);
      expect(rest.repos.get).toHaveBeenCalledWith({ owner: o1, repo: r1 });
      expect(rest.repos.get).toHaveBeenCalledWith({ owner: o2, repo: r2 });
      expect(rest.issues.createComment).toHaveBeenCalledTimes(2);

      expect(logger.info as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: FUNCTION_NAME, repoCount: 2 },
        'GitHub token validated — Issues read & write confirmed for all repos',
      );
    });

    it('expands user-scope wildcards via listForUser', async () => {
      mockAuth();
      const { fullName: repo } = makeUniqueRepoName();
      const { owner } = splitRepo(repo);
      const repoFilter: RepoFilter[] = [{ pattern: `${owner}/*`, scope: 'user' }];

      rest.repos.listForUser.mockResolvedValue({ data: [{ full_name: repo }] });
      rest.repos.get.mockResolvedValue({ data: {} });
      rest.issues.createComment.mockRejectedValue({ status: 404 });

      await validateGitHubToken({ octokit, repoFilter, log: logger });

      expect(rest.repos.listForUser).toHaveBeenCalledWith({
        username: owner,
        per_page: 100,
        page: 1,
        sort: 'updated',
        type: 'owner',
      });
      expect(rest.issues.createComment).toHaveBeenCalledTimes(1);
    });

    it('paginates listForUser when results span multiple pages', async () => {
      mockAuth();
      const repos = Array.from({ length: 150 }, () => makeUniqueRepoName().fullName);
      const repoFilter: RepoFilter[] = [{ pattern: 'owner/*', scope: 'user' }];

      rest.repos.listForUser
        .mockResolvedValueOnce({ data: repos.slice(0, 100).map((fn) => ({ full_name: fn })) })
        .mockResolvedValueOnce({ data: repos.slice(100).map((fn) => ({ full_name: fn })) });
      rest.repos.get.mockResolvedValue({ data: {} });
      rest.issues.createComment.mockRejectedValue({ status: 404 });

      await validateGitHubToken({ octokit, repoFilter, log: logger });

      expect(rest.repos.listForUser).toHaveBeenCalledTimes(2);
      expect(rest.issues.createComment).toHaveBeenCalledTimes(150);
    });

    it('treats createComment resolving as write access confirmed', async () => {
      mockAuth();
      const { fullName: repo } = makeUniqueRepoName();
      const repoFilter: RepoFilter[] = [{ pattern: repo, scope: 'repo' }];
      rest.repos.get.mockResolvedValue({ data: {} });
      rest.issues.createComment.mockResolvedValue({ data: {} });

      await validateGitHubToken({ octokit, repoFilter, log: logger });

      expect(logger.info as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: FUNCTION_NAME, repoCount: 1 },
        'GitHub token validated — Issues read & write confirmed for all repos',
      );
    });
  });

  describe('some repos fail', () => {
    it('logs a warning for each repo with 403 and summarizes at the end', async () => {
      mockAuth();
      const { fullName: passRepo } = makeUniqueRepoName();
      const { fullName: failRepo } = makeUniqueRepoName();
      const repoFilter: RepoFilter[] = [
        { pattern: passRepo, scope: 'repo' },
        { pattern: failRepo, scope: 'repo' },
      ];

      rest.repos.get.mockResolvedValue({ data: {} });
      rest.issues.createComment.mockRejectedValueOnce({ status: 404 }).mockRejectedValueOnce({ status: 403 });

      await validateGitHubToken({ octokit, repoFilter, log: logger });

      expect(logger.warn as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: FUNCTION_NAME, repo: failRepo },
        `Token lacks Issues write on "${failRepo}". Edit the token at ${TOKEN_SETTINGS_URL} and grant Issues read & write to this repository.`,
      );
      expect(logger.warn as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: FUNCTION_NAME, passed: 1, failed: 1, total: 2 },
        'GitHub token lacks Issues write on 1 out of 2 repos. See warnings above for details.',
      );
    });

    it('logs a warning when a repo is not accessible', async () => {
      mockAuth();
      const { fullName: repo } = makeUniqueRepoName();
      const repoFilter: RepoFilter[] = [{ pattern: repo, scope: 'repo' }];

      rest.repos.get.mockRejectedValue({ status: 404 });

      await validateGitHubToken({ octokit, repoFilter, log: logger });

      expect(rest.issues.createComment).not.toHaveBeenCalled();
      expect(logger.warn as jest.Mock<any>).toHaveBeenCalledWith({ fn: FUNCTION_NAME, repo }, 'Repository not accessible with this token');
    });

    it('logs a warning for unexpected write-probe errors', async () => {
      mockAuth();
      const { fullName: repo } = makeUniqueRepoName();
      const repoFilter: RepoFilter[] = [{ pattern: repo, scope: 'repo' }];

      rest.repos.get.mockResolvedValue({ data: {} });
      const networkError = new Error('Network error');
      rest.issues.createComment.mockRejectedValue(networkError);

      await validateGitHubToken({ octokit, repoFilter, log: logger });

      const { owner, repo: repoName } = splitRepo(repo);
      expect(logger.warn as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: FUNCTION_NAME, repo, error: networkError },
        `Unexpected error validating write access to "${repo}"`,
      );
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
