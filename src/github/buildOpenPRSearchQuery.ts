import type { RepoFilter } from '../types/index.js';

import { buildRepoQualifierClause } from './index.js';

/**
 * Build a GitHub issue search query for open PRs in monitored repos.
 */
export const buildOpenPRSearchQuery = (repoFilter: readonly RepoFilter[]): string => {
  return ['is:pr', 'state:open', buildRepoQualifierClause(repoFilter)].filter((part): part is string => Boolean(part)).join(' ');
};
