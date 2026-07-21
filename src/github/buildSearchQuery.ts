import { REVIEW_BOT_RATE_LIMIT_SEARCH_TEXTS } from '../types/coderabbit.js';
import type { RepoFilter } from '../types/RepoFilter.js';

import { buildRepoQualifierClause } from './index.js';

/**
 * Build the GitHub issue search query from a list of repo filter entries.
 */
export const buildSearchQuery = (repoFilter: readonly RepoFilter[]): string => {
  const searchClause = `(${REVIEW_BOT_RATE_LIMIT_SEARCH_TEXTS.map((t) => `"${t}"`).join(' OR ')})`;

  return [searchClause, 'type:pr', 'state:open', buildRepoQualifierClause(repoFilter)].filter((part): part is string => Boolean(part)).join(' ');
};
