import { RabbitMaximizerError, RabbitMaximizerErrorCodes } from './errors/index.js';
import { splitRepo } from './github/index.js';
import type { RepoFilter } from './types/index.js';

import type { Logger } from '@couimet/logger-contract';
import type { Octokit } from '@octokit/rest';

const FUNCTION_NAME = 'validateGitHubToken';
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

export const validateGitHubToken = async (params: ValidateTokenParams): Promise<void> => {
  const { octokit, repoFilter, log } = params;

  const { data: user } = await octokit.rest.users.getAuthenticated();
  log.info({ fn: FUNCTION_NAME, login: user.login }, 'GitHub token authenticated');

  const repos = await resolveAllRepos(octokit, repoFilter);
  log.info({ fn: FUNCTION_NAME, repoCount: repos.length }, `Resolved ${repos.length} repos from filter`);
};
