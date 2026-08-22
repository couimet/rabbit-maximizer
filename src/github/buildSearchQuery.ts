import type { RepoFilter } from '../types/index.js';

import { buildRepoQualifierClause, REVIEW_BOT_RATE_LIMIT_SEARCH_TEXTS, REVIEW_BOT_SKIP_SEARCH_TEXTS } from './index.js';

export const buildSearchQuery = (repoFilter: readonly RepoFilter[]): string => {
  const searchTexts = [...REVIEW_BOT_RATE_LIMIT_SEARCH_TEXTS, ...REVIEW_BOT_SKIP_SEARCH_TEXTS];
  const searchClause = `(${searchTexts.map((t) => `"${t}"`).join(' OR ')})`;

  return [searchClause, 'type:pr', 'state:open', buildRepoQualifierClause(repoFilter)].filter((part): part is string => Boolean(part)).join(' ');
};
