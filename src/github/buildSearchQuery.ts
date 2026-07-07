import { REVIEW_BOT_RATE_LIMIT_SEARCH_TEXTS } from '../types/coderabbit.js';
import type { RepoFilter } from '../types/RepoFilter.js';

/**
 * Build the GitHub issue search query from a list of repo filter entries.
 *
 * Scopes:
 *   user — `user:<owner>` qualifier (wildcard patterns like `owner/*`)
 *   repo — `repo:<owner>/<name>` qualifier (explicit repos)
 */
export const buildSearchQuery = (repoFilter: readonly RepoFilter[]): string => {
  const qualifiers = repoFilter.map((f) => {
    if (f.scope === 'user') {
      const owner = f.pattern.split('/')[0];
      return `user:${owner}`;
    }
    return `repo:${f.pattern}`;
  });
  const qualifierClause = qualifiers.length === 0 ? undefined : qualifiers.length === 1 ? qualifiers[0] : `(${qualifiers.join(' OR ')})`;

  const searchClause = `(${REVIEW_BOT_RATE_LIMIT_SEARCH_TEXTS.map((t) => `"${t}"`).join(' OR ')})`;

  return [searchClause, 'type:pr', 'state:open', qualifierClause].filter((part): part is string => Boolean(part)).join(' ');
};
