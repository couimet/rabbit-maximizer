import { RabbitMaximizerError } from './errors/RabbitMaximizerError.js';
import { RabbitMaximizerErrorCodes } from './errors/RabbitMaximizerErrorCodes.js';
import { splitRepo } from './github/splitRepo.js';
import type { RepoFilter } from './types/RepoFilter.js';

import type { Logger } from '@couimet/logger-contract';
import type { Octokit } from '@octokit/rest';

const FUNCTION_NAME = 'validateGitHubToken';
const TOKEN_SETTINGS_URL = 'https://github.com/settings/personal-access-tokens';
const NONEXISTENT_ISSUE = 99_999_999;
const LIST_PER_PAGE = 100;

interface ValidateTokenParams {
  octokit: Octokit;
  repoFilter: readonly RepoFilter[];
  log: Logger;
}

const resolveAllRepos = async (octokit: Octokit, repoFilter: readonly RepoFilter[]): Promise<string[]> => {
  const repos: string[] = [];

  for (const filter of repoFilter) {
    if (filter.scope === 'repo') {
      repos.push(filter.pattern);
      continue;
    }

    const { owner } = splitRepo(filter.pattern);
    let page = 1;

    while (true) {
      const { data } = await octokit.rest.repos.listForUser({
        username: owner,
        per_page: LIST_PER_PAGE,
        page,
        sort: 'updated',
        type: 'owner',
      });

      for (const repo of data) {
        repos.push(repo.full_name);
      }

      if (data.length < LIST_PER_PAGE) break;
      page++;
    }
  }

  if (repos.length === 0) {
    throw new RabbitMaximizerError({
      code: RabbitMaximizerErrorCodes.TOKEN_VALIDATION_EMPTY_FILTER,
      functionName: 'resolveAllRepos',
      message: 'REPO_FILTER resolved to zero repositories. Check that the filter matches at least one accessible repo.',
    });
  }

  return repos;
};

const probeWriteAccess = async (octokit: Octokit, repo: string, log: Logger): Promise<boolean> => {
  const { owner, repo: repoName } = splitRepo(repo);

  try {
    await octokit.rest.repos.get({ owner, repo: repoName });
  } catch {
    log.warn({ fn: FUNCTION_NAME, repo }, 'Repository not accessible with this token');
    return false;
  }

  try {
    await octokit.rest.issues.createComment({
      owner,
      repo: repoName,
      issue_number: NONEXISTENT_ISSUE,
      body: 'token-validation-probe',
    });
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 403) {
      log.warn(
        { fn: FUNCTION_NAME, repo },
        `Token lacks Issues write on "${repo}". Edit the token at ${TOKEN_SETTINGS_URL} and grant Issues read & write to this repository.`,
      );
      return false;
    }
    if (status !== 404) {
      log.warn({ fn: FUNCTION_NAME, repo, error: err }, `Unexpected error validating write access to "${repo}"`);
      return false;
    }
  }

  return true;
};

export const validateGitHubToken = async (params: ValidateTokenParams): Promise<void> => {
  const { octokit, repoFilter, log } = params;

  const { data: user } = await octokit.rest.users.getAuthenticated();
  log.info({ fn: FUNCTION_NAME, login: user.login }, 'GitHub token authenticated');

  const repos = await resolveAllRepos(octokit, repoFilter);
  log.info({ fn: FUNCTION_NAME, repoCount: repos.length }, `Validating token against ${repos.length} repos`);

  const results = await Promise.all(repos.map((repo) => probeWriteAccess(octokit, repo, log)));

  const passed = results.filter(Boolean).length;
  const failed = repos.length - passed;

  if (failed === 0) {
    log.info({ fn: FUNCTION_NAME, repoCount: repos.length }, 'GitHub token validated — Issues read & write confirmed for all repos');
  } else {
    log.warn(
      { fn: FUNCTION_NAME, passed, failed, total: repos.length },
      `GitHub token lacks Issues write on ${failed} out of ${repos.length} repos. See warnings above for details.`,
    );
  }
};
