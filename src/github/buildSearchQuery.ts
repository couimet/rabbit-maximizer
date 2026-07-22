import type { RepoFilter } from '../types/index.js';

import { buildRepoQualifierClause, REVIEW_BOT_RATE_LIMIT_SEARCH_TEXTS } from './index.js';

/**
 * Build the GitHub issue search query from a list of repo filter entries.
 */
export const buildSearchQuery = (repoFilter: readonly RepoFilter[]): string => {
  const searchClause = `(${REVIEW_BOT_RATE_LIMIT_SEARCH_TEXTS.map((t) => `"${t}"`).join(' OR ')})`;

  return [searchClause, 'type:pr', 'state:open', buildRepoQualifierClause(repoFilter)].filter((part): part is string => Boolean(part)).join(' ');
};
